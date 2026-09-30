//routes/admin.route.js

import express from "express";

import adminVerifyToken from "./AdminVerifyToken.js";

import * as adminCtrl from "../controllers/admin/admin.js";
import * as customerCtrl from "../controllers/admin/customer.js";

import imageUpload from "../middleware/imageUpload.js";

const router = express.Router();

// ADMIN

router.route("/users/setpassword").post(adminCtrl.setpassword);

router.route("/users/verifylogin").post(adminCtrl.verifyLogin);

// CUSTOMERS

router.get("/customers/list", adminVerifyToken, customerCtrl.listCustomers);

router.get("/customers/view", adminVerifyToken, customerCtrl.viewCustomer);

router.post(
  "/customers/create",
  adminVerifyToken,
  imageUpload("customers").single("profile"),
  customerCtrl.createCustomer,
);

router.post(
  "/customers/update",
  adminVerifyToken,
  imageUpload("customers").single("profile"),
  customerCtrl.updateCustomer,
);

router.post("/customers/delete", adminVerifyToken, customerCtrl.deleteCustomer);

export default router;
