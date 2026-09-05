import { afterEach, describe, expect, it, vi } from "vitest";
import { Order } from "../src/modules/orders/order.model.js";
import { Quote } from "../src/modules/quotes/quote.model.js";
import { User } from "../src/modules/auth/user.model.js";
import { assign, update } from "../src/modules/orders/order.controller.js";

const auth = {
  userId: "507f1f77bcf86cd799439011",
  role: "sales_manager",
  user: { firstName: "Sales", lastName: "Manager", email: "manager@example.com" },
};

const response = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const orderDocument = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439021",
  quote: "507f1f77bcf86cd799439022",
  reference: "LAO-TEST-100001",
  assignedTo: auth.userId,
  fulfillmentStatus: "pending",
  activity: [],
  save: vi.fn().mockResolvedValue(undefined),
  populate: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe("sales order workflow", () => {
  it("updates fulfillment and mirrors the audit event to its quote without changing ownership", async () => {
    const order = orderDocument();
    vi.spyOn(Order, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(order) });
    const quoteUpdate = vi.spyOn(Quote, "updateOne").mockResolvedValue({ acknowledged: true });

    await update({ params: { id: order._id }, body: { fulfillmentStatus: "production" }, auth }, response());

    expect(order.fulfillmentStatus).toBe("production");
    expect(order.save).toHaveBeenCalledOnce();
    expect(quoteUpdate).toHaveBeenCalledWith(
      { _id: order.quote },
      expect.objectContaining({ $push: expect.any(Object) }),
    );
    expect(quoteUpdate.mock.calls[0][1].$set).toBeUndefined();
  });

  it("keeps paid-order and quote ownership synchronized on manager reassignment", async () => {
    const order = orderDocument({ assignedTo: undefined });
    const assignee = {
      _id: "507f1f77bcf86cd799439099",
      firstName: "New",
      lastName: "Owner",
    };
    vi.spyOn(Order, "findOne").mockReturnValue({ select: vi.fn().mockResolvedValue(order) });
    vi.spyOn(User, "findOne").mockResolvedValue(assignee);
    const quoteUpdate = vi.spyOn(Quote, "updateOne").mockResolvedValue({ acknowledged: true });

    await assign(
      { params: { id: order._id }, body: { assigneeId: assignee._id }, auth },
      response(),
    );

    expect(String(order.assignedTo)).toBe(assignee._id);
    expect(quoteUpdate).toHaveBeenCalledWith(
      { _id: order.quote },
      expect.objectContaining({
        $set: expect.objectContaining({ assignedTo: assignee._id }),
        $push: expect.any(Object),
      }),
    );
  });
});
