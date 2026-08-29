import { spawn } from "node:child_process";
import { cloudinary } from "../../config/cloudinary.js";
import { cloudinaryEnabled, env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../common/errors/AppError.js";

const sdkAttempts = 2;
const curlMaxOutputBytes = 1024 * 1024;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function uploadContext(file, folder) {
  return {
    folder,
    filename: file.originalname,
    mimetype: file.mimetype,
    bytes: file.size ?? file.buffer?.length,
  };
}

function safeErrorDetails(error) {
  return {
    name: error?.name,
    message: error?.message || "No error message was provided",
    code: error?.code,
    errno: error?.errno,
    httpCode: error?.http_code,
    nested: Array.isArray(error?.errors)
      ? error.errors.slice(0, 4).map((item) => ({
        message: item?.message,
        code: item?.code,
        errno: item?.errno,
        address: item?.address,
        port: item?.port,
      }))
      : undefined,
  };
}

function needsNetworkFallback(error) {
  const networkCodes = new Set(["ENETUNREACH", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"]);
  if (networkCodes.has(error?.code)) return true;
  return Array.isArray(error?.errors) && error.errors.some((item) => networkCodes.has(item?.code));
}

function mapUpload(result) {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    bytes: result.bytes,
    format: result.format,
  };
}

function sdkUpload(file, folder, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder,
      resource_type: resourceType,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      timeout: 30_000,
    }, (error, result) => {
      if (error) return reject(error);
      if (!result?.secure_url) return reject(new Error("Cloudinary returned no secure URL"));
      return resolve(mapUpload(result));
    });
    stream.end(file.buffer);
  });
}

function curlUpload(file, folder, resourceType) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedParams = {
    folder,
    overwrite: "false",
    timestamp,
    unique_filename: "true",
    use_filename: "true",
  };
  const signature = cloudinary.utils.api_sign_request(signedParams, env.CLOUDINARY_API_SECRET);
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`;
  const extension = file.originalname?.match(/\.[a-z0-9]{1,8}$/i)?.[0] || "";
  const filename = `upload${extension}`;
  const command = process.platform === "win32" ? "curl.exe" : "curl";
  const args = [
    "-sS",
    "--fail-with-body",
    "--connect-timeout", "20",
    "--max-time", "180",
    "--retry", "2",
    "--retry-all-errors",
    "-X", "POST",
    endpoint,
    "-F", `file=@-;filename=${filename};type=${file.mimetype}`,
    "-F", `api_key=${env.CLOUDINARY_API_KEY}`,
    "-F", `timestamp=${timestamp}`,
    "-F", `folder=${folder}`,
    "-F", "overwrite=false",
    "-F", "unique_filename=true",
    "-F", "use_filename=true",
    "-F", `signature=${signature}`,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;

    const collect = (target) => (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes <= curlMaxOutputBytes) target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.on("error", reject);
    child.on("close", (code) => {
      const body = Buffer.concat(stdout).toString("utf8");
      let result;
      try {
        result = JSON.parse(body);
      } catch {
        result = null;
      }
      if (code !== 0 || !result?.secure_url) {
        const message = result?.error?.message
          || Buffer.concat(stderr).toString("utf8").trim()
          || `curl exited with code ${code}`;
        const error = new Error(message);
        error.code = code === null ? "CURL_TERMINATED" : `CURL_EXIT_${code}`;
        return reject(error);
      }
      return resolve(mapUpload(result));
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") reject(error);
    });
    child.stdin.end(file.buffer);
  });
}

export async function uploadBuffer(file, folder = "legacy-trophies/uploads") {
  if (!cloudinaryEnabled) {
    throw new AppError(503, "UPLOADS_NOT_CONFIGURED", "Cloud uploads are not configured");
  }
  const resourceType = file.mimetype === "application/pdf" ? "raw" : "image";
  let sdkError;

  for (let attempt = 1; attempt <= sdkAttempts; attempt += 1) {
    try {
      return await sdkUpload(file, folder, resourceType);
    } catch (error) {
      sdkError = error;
      logger.warn({
        upload: uploadContext(file, folder),
        attempt,
        maxAttempts: sdkAttempts,
        cloudinaryError: safeErrorDetails(error),
      }, "Cloudinary SDK upload attempt failed");
      if (needsNetworkFallback(error)) break;
      if (attempt < sdkAttempts) await wait(attempt * 800);
    }
  }

  logger.warn({
    upload: uploadContext(file, folder),
    cloudinaryError: safeErrorDetails(sdkError),
  }, "Falling back to signed curl upload");

  try {
    const uploaded = await curlUpload(file, folder, resourceType);
    logger.info({ upload: uploadContext(file, folder), publicId: uploaded.publicId }, "Cloudinary curl fallback upload succeeded");
    return uploaded;
  } catch (curlError) {
    logger.error({
      upload: uploadContext(file, folder),
      sdkError: safeErrorDetails(sdkError),
      curlError: safeErrorDetails(curlError),
    }, "Cloudinary SDK and curl fallback uploads failed");
    throw new AppError(502, "UPLOAD_FAILED", "The file could not be uploaded. Please try again.");
  }
}
