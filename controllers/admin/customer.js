// controllers/admin/customer.js

import crypto from "crypto";
import fs from "fs";
import path from "path";
import Config from "../../config.js";

// Constants

const GROUP_SUPERADMIN = 1;
const GROUP_AGENT = 2;
const GROUP_CUSTOMER = 3;

// Safe columns

const SAFE_COLUMNS = `
  u.id,
  u.group_id,
  u.first_name,
  u.last_name,
  u.email_id,
  u.phone,
  u.country_code,
  u.gender,
  u.profile,
  u.dob,
  u.marital_status,
  u.city,
  u.state,
  u.country,
  u.passport_number,
  u.passport_exp_date,
  u.passport_issue_country,
  u.spl_id_type,
  u.spl_id_number,
  u.created_at
`;

// Editable fields

// profile is intentionally NOT here.
// Image is handled separately using req.file.
const TEXT_FIELDS = [
  "first_name",
  "last_name",
  "email_id",
  "phone",
  "country_code",
  "gender",
  "marital_status",
  "city",
  "passport_number",
  "spl_id_number",
];

const DATE_FIELDS = ["dob", "passport_exp_date"];

const INT_FIELDS = [
  "state",
  "country",
  "passport_issue_country",
  "spl_id_type",
];

// Sort whitelist

const SORT_COLUMNS = {
  id: "u.id",
  first_name: "u.first_name",
  last_name: "u.last_name",
  email_id: "u.email_id",
  phone: "u.phone",
  created_at: "u.created_at",
};

// Helpers

const runQuery = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });

const getPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");

  return {
    salt,
    hash,
  };
};

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const valueString = String(value).trim();

  return valueString === "" ? null : valueString;
};

const cleanInt = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = parseInt(value, 10);

  return Number.isNaN(number) ? null : number;
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Profile image helper

export const deleteProfileImage = (profile) => {
  if (!profile) {
    return;
  }

  try {
    const filename = path.basename(String(profile));

    if (!filename) {
      return;
    }

    const filePath = path.join("public", "customers", filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("deleteProfileImage error:", error);
  }
};

// Permission

const ensureStaff = (req, res) => {
  const groupId = Number(req.groupId);

  if (groupId !== GROUP_SUPERADMIN && groupId !== GROUP_AGENT) {
    res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action",
      datas: [],
    });

    return false;
  }

  return true;
};

const ensureSuperadmin = (req, res) => {
  const groupId = Number(req.groupId);

  if (groupId !== GROUP_SUPERADMIN) {
    res.status(403).json({
      success: false,
      message: "Only super admin can delete customers",
      datas: [],
    });

    return false;
  }

  return true;
};

// Duplicate checks

const emailInUse = async (db, email, excludeId = null) => {
  let sql = `
    SELECT id
    FROM smt_users
    WHERE email_id = ?
      AND deleted = 0
  `;

  const params = [email];

  if (excludeId) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await runQuery(db, sql, params);

  return rows.length > 0;
};

const phoneInUse = async (db, phone, countryCode, excludeId = null) => {
  let sql = `
    SELECT id
    FROM smt_users
    WHERE phone = ?
      AND country_code = ?
      AND deleted = 0
  `;

  const params = [phone, countryCode];

  if (excludeId) {
    sql += ` AND id <> ?`;
    params.push(excludeId);
  }

  sql += ` LIMIT 1`;

  const rows = await runQuery(db, sql, params);

  return rows.length > 0;
};
const getProfileUrl = (profile) => {
  if (!profile) {
    return null;
  }

  // Already a full URL
  if (/^https?:\/\//i.test(profile)) {
    return profile;
  }

  const fileUrl = String(Config.fileurl || "").replace(/\/+$/, "");
  const profilePath = String(profile).replace(/^\/+/, "");

  return `${fileUrl}/${profilePath.replace(/^public\//, "")}`;
};

// LIST CUSTOMERS

export const listCustomers = async (req, res) => {
  if (!ensureStaff(req, res)) {
    return;
  }

  const db = req.db;

  try {
    const src = req.query || {};

    const page = Math.max(cleanInt(src.page) || 1, 1);

    const limit = Math.min(Math.max(cleanInt(src.limit) || 10, 1), 100);

    const offset = (page - 1) * limit;

    const sortCol = SORT_COLUMNS[src.sort_by] || SORT_COLUMNS.id;

    const sortDir =
      String(src.sort_order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const where = ["u.group_id = ?", "u.deleted = 0"];

    const params = [GROUP_CUSTOMER];

    const search = cleanText(src.search);

    if (search) {
      where.push(`
        (
          u.first_name LIKE ?
          OR u.last_name LIKE ?
          OR u.email_id LIKE ?
          OR u.phone LIKE ?
          OR CONCAT_WS(
              ' ',
              u.first_name,
              u.last_name
            ) LIKE ?
        )
      `);

      const like = `%${search}%`;

      params.push(like, like, like, like, like);
    }

    const whereSql = where.join(" AND ");

    // Count
    const countRows = await runQuery(
      db,
      `
        SELECT COUNT(*) AS total
        FROM smt_users u
        WHERE ${whereSql}
      `,
      params,
    );

    const total = Number(countRows[0]?.total || 0);

    // Data
    const rows = await runQuery(
      db,
      `
        SELECT ${SAFE_COLUMNS}
        FROM smt_users u
        WHERE ${whereSql}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );
    const formattedRows = rows.map((row) => ({
      ...row,
      profile: getProfileUrl(row.profile),
    }));
    return res.status(200).json({
      success: true,
      message: "Customers fetched successfully",

      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },

      // datas: rows,
      datas: formattedRows,
    });
  } catch (error) {
    console.error("listCustomers error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

// VIEW CUSTOMER

export const viewCustomer = async (req, res) => {
  if (!ensureStaff(req, res)) {
    return;
  }

  const db = req.db;

  try {
    // ID comes from query parameter
    // Example:
    // /admin/customers/view?id=4
    const id = cleanInt(req.query?.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "customer id missing",
        datas: [],
      });
    }

    const rows = await runQuery(
      db,
      `
        SELECT
          ${SAFE_COLUMNS},
          c.name AS country_name,
          pc.name AS passport_issue_country_name

        FROM smt_users u

        LEFT JOIN smt_country c
          ON c.country_id = u.country

        LEFT JOIN smt_country pc
          ON pc.country_id = u.passport_issue_country

        WHERE u.id = ?
          AND u.group_id = ?
          AND u.deleted = 0

        LIMIT 1
      `,
      [id, GROUP_CUSTOMER],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
        datas: [],
      });
    }

    // return res.status(200).json({
    //   success: true,
    //   message: "Customer fetched successfully",
    //   datas: [rows[0]],
    // });
    const customer = {
      ...rows[0],
      profile: getProfileUrl(rows[0].profile),
    };

    return res.status(200).json({
      success: true,
      message: "Customer fetched successfully",
      datas: [customer],
    });
  } catch (error) {
    console.error("viewCustomer error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

// CREATE CUSTOMER

export const createCustomer = async (req, res) => {
  if (!ensureStaff(req, res)) {
    return;
  }

  const db = req.db;

  try {
    const body = req.body || {};

    const data = {};

    TEXT_FIELDS.forEach((field) => {
      data[field] = cleanText(body[field]);
    });

    DATE_FIELDS.forEach((field) => {
      data[field] = cleanText(body[field]);
    });

    INT_FIELDS.forEach((field) => {
      data[field] = cleanInt(body[field]);
    });

    // --------------------------------------------------------------
    // Email / phone validation
    // --------------------------------------------------------------

    if (!data.email_id && !data.phone) {
      return res.status(400).json({
        success: false,
        message: "email_id or phone is required",
        datas: [],
      });
    }

    if (data.email_id) {
      if (!isValidEmail(data.email_id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email_id",
          datas: [],
        });
      }

      if (await emailInUse(db, data.email_id)) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
          datas: [],
        });
      }
    }

    if (data.phone) {
      if (!data.country_code) {
        return res.status(400).json({
          success: false,
          message: "country_code missing",
          datas: [],
        });
      }

      if (await phoneInUse(db, data.phone, data.country_code)) {
        return res.status(409).json({
          success: false,
          message: "Phone already exists",
          datas: [],
        });
      }
    }

    // --------------------------------------------------------------
    // Build insert
    // --------------------------------------------------------------

    const columns = ["group_id"];

    const values = [GROUP_CUSTOMER];

    [...TEXT_FIELDS, ...DATE_FIELDS, ...INT_FIELDS].forEach((field) => {
      if (data[field] !== null) {
        columns.push(field);
        values.push(data[field]);
      }
    });

    // --------------------------------------------------------------
    // Profile image
    // --------------------------------------------------------------

    if (req.file) {
      columns.push("profile");

      values.push(`/public/customers/${req.file.filename}`);
    }

    // --------------------------------------------------------------
    // Password
    // --------------------------------------------------------------

    const password = cleanText(body.password);

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
          datas: [],
        });
      }

      const { salt, hash } = getPassword(password);

      columns.push("salt", "hash");

      values.push(salt, hash);
    }

    const placeholders = columns.map(() => "?").join(", ");

    const result = await runQuery(
      db,
      `
        INSERT INTO smt_users
        (${columns.join(", ")})
        VALUES (${placeholders})
      `,
      values,
    );

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",

      datas: [
        {
          id: result.insertId,
        },
      ],
    });
  } catch (error) {
    // If DB insertion fails after image upload,
    // remove the newly uploaded image.
    if (req.file) {
      try {
        const filePath = path.join("public", "customers", req.file.filename);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error("Uploaded image cleanup error:", fileError);
      }
    }

    console.error("createCustomer error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

// UPDATE CUSTOMER

export const updateCustomer = async (req, res) => {
  if (!ensureStaff(req, res)) {
    return;
  }

  const db = req.db;

  try {
    const body = req.body || {};

    // ID MUST come from body
    const id = cleanInt(body.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "customer id missing in request body",
        datas: [],
      });
    }

    // --------------------------------------------------------------
    // Existing customer
    // --------------------------------------------------------------

    const existing = await runQuery(
      db,
      `
        SELECT
          id,
          email_id,
          phone,
          country_code,
          profile
        FROM smt_users

        WHERE id = ?
          AND group_id = ?
          AND deleted = 0

        LIMIT 1
      `,
      [id, GROUP_CUSTOMER],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
        datas: [],
      });
    }

    const current = existing[0];

    const fields = [];
    const values = [];

    // --------------------------------------------------------------
    // Text fields
    // --------------------------------------------------------------

    TEXT_FIELDS.forEach((field) => {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);

        values.push(cleanText(body[field]));
      }
    });

    // --------------------------------------------------------------
    // Date fields
    // --------------------------------------------------------------

    DATE_FIELDS.forEach((field) => {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);

        values.push(cleanText(body[field]));
      }
    });

    // --------------------------------------------------------------
    // Integer fields
    // --------------------------------------------------------------

    INT_FIELDS.forEach((field) => {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`);

        values.push(cleanInt(body[field]));
      }
    });

    // --------------------------------------------------------------
    // Email validation
    // --------------------------------------------------------------

    if (body.email_id !== undefined) {
      const newEmail = cleanText(body.email_id);

      if (newEmail) {
        if (!isValidEmail(newEmail)) {
          return res.status(400).json({
            success: false,
            message: "Invalid email_id",
            datas: [],
          });
        }

        if (await emailInUse(db, newEmail, id)) {
          return res.status(409).json({
            success: false,
            message: "Email already exists",
            datas: [],
          });
        }
      }
    }

    // --------------------------------------------------------------
    // Phone validation
    // --------------------------------------------------------------

    if (body.phone !== undefined || body.country_code !== undefined) {
      const newPhone =
        body.phone !== undefined ? cleanText(body.phone) : current.phone;

      const newCountryCode =
        body.country_code !== undefined
          ? cleanText(body.country_code)
          : current.country_code;

      if (newPhone) {
        if (!newCountryCode) {
          return res.status(400).json({
            success: false,
            message: "country_code missing",
            datas: [],
          });
        }

        if (await phoneInUse(db, newPhone, newCountryCode, id)) {
          return res.status(409).json({
            success: false,
            message: "Phone already exists",
            datas: [],
          });
        }
      }
    }

    // --------------------------------------------------------------
    // New profile image
    // --------------------------------------------------------------

    if (req.file) {
      fields.push("profile = ?");

      values.push(`/public/customers/${req.file.filename}`);
    }

    // --------------------------------------------------------------
    // Password
    // --------------------------------------------------------------

    const password = cleanText(body.password);

    if (password) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters",
          datas: [],
        });
      }

      const { salt, hash } = getPassword(password);

      fields.push("salt = ?", "hash = ?");

      values.push(salt, hash);
    }

    // --------------------------------------------------------------
    // No changes
    // --------------------------------------------------------------

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
        datas: [],
      });
    }

    values.push(id, GROUP_CUSTOMER);

    await runQuery(
      db,
      `
        UPDATE smt_users

        SET ${fields.join(", ")}

        WHERE id = ?
          AND group_id = ?
          AND deleted = 0
      `,
      values,
    );

    // --------------------------------------------------------------
    // Delete old image AFTER successful update
    // --------------------------------------------------------------

    if (req.file && current.profile) {
      deleteProfileImage(current.profile);
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      datas: [],
    });
  } catch (error) {
    // New image was uploaded but DB update failed.
    // Delete the new image.
    if (req.file) {
      try {
        const filePath = path.join("public", "customers", req.file.filename);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.error("New image cleanup error:", fileError);
      }
    }

    console.error("updateCustomer error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

// DELETE CUSTOMER

export const deleteCustomer = async (req, res) => {
  if (!ensureSuperadmin(req, res)) {
    return;
  }

  const db = req.db;

  try {
    // ID MUST come from body
    const id = cleanInt(req.body?.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "customer id missing in request body",
        // datas: [],
      });
    }

    // --------------------------------------------------------------
    // Get existing profile
    // --------------------------------------------------------------

    const existing = await runQuery(
      db,
      `
        SELECT id, profile
        FROM smt_users

        WHERE id = ?
          AND group_id = ?
          AND deleted = 0

        LIMIT 1
      `,
      [id, GROUP_CUSTOMER],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
        // datas: [],
      });
    }

    const current = existing[0];

    // --------------------------------------------------------------
    // Soft delete
    // --------------------------------------------------------------

    const result = await runQuery(
      db,
      `
        UPDATE smt_users

        SET deleted = 1

        WHERE id = ?
          AND group_id = ?
          AND deleted = 0
      `,
      [id, GROUP_CUSTOMER],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
        // datas: [],
      });
    }

    // --------------------------------------------------------------
    // Remove profile image
    // --------------------------------------------------------------

    if (current.profile) {
      deleteProfileImage(current.profile);
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      // datas: [],
    });
  } catch (error) {
    console.error("deleteCustomer error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      // datas: [],
    });
  }
};
