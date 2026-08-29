const CLOUDINARY_UPLOAD = "/image/upload/";

export function optimizedImage(url, width = 800) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return url;
  const transformation = `f_auto,q_auto:best,c_limit,w_${Math.max(1, Math.round(width))}`;
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}${transformation}/`);
}

export function squareThumbnail(url, size = 112) {
  if (!url || !url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD)) return url;
  const pixels = Math.max(1, Math.round(size));
  const transformation = `f_auto,q_auto,c_fill,w_${pixels},h_${pixels}`;
  return url.replace(CLOUDINARY_UPLOAD, `${CLOUDINARY_UPLOAD}${transformation}/`);
}

export function responsiveImageProps(url, widths = [360, 640, 960]) {
  if (!url?.includes("res.cloudinary.com")) return { src: url };
  return {
    src: optimizedImage(url, widths.at(-1)),
    srcSet: widths.map((width) => `${optimizedImage(url, width)} ${width}w`).join(", "),
  };
}
