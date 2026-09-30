//import getPool from '../db.js';
import config from "../../config.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Config from "../../config.js";
import { deleteProfileImage } from "../admin/customer.js";
function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function getPassword(password = "nativeappstech") {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return { salt, hash };
}

function generateJwt(id, group_id) {
  return jwt.sign({ id, group_id }, config.secret, { expiresIn: "7d" });
}

function validPassword(password, salt, hashFromDB) {
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, "sha512")
    .toString("hex");
  return hash === hashFromDB;
}

export const checkPhoneExists = async (phone, country_code, db) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT id FROM smt_users WHERE phone = ? AND country_code = ? LIMIT 1`;

    db.query(query, [phone, country_code], (err, results) => {
      if (err) return reject(err);

      if (results.length > 0) {
        resolve(true); //  found
      } else {
        resolve(false); //  not found
      }
    });
  });
};

export const checkEmailExists = async (email, db) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT id FROM smt_users WHERE email_id = ? LIMIT 1`;

    db.query(query, [email], (err, results) => {
      if (err) return reject(err);

      if (results.length > 0) {
        resolve(true); // email found
      } else {
        resolve(false); // email not found
      }
    });
  });
};

export const checkEmailPresent = async (req, res) => {
  const db = req.db;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "email missing",
      datas: [],
    });
  }

  try {
    const exists = await checkEmailExists(email, db);

    return res.status(200).json({
      success: true,
      exists: exists,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

export const checkPhonePresent = async (req, res) => {
  const db = req.db;
  const { phone, country_code } = req.body;

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: "phone missing",
      datas: [],
    });
  }

  if (!country_code) {
    return res.status(400).json({
      success: false,
      message: "country code missing",
      datas: [],
    });
  }
  try {
    const exists = await checkPhoneExists(phone, country_code, db);

    return res.status(200).json({
      success: true,
      exists: exists,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

export const sendOTP = async (req, res) => {
  try {
    const otp = getRandomInt(100000, 999999);
    const { salt, hash } = getPassword("smt" + otp);

    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "All input missing",
      });
    }

    const { email, phone_number, countrycode } = req.body;
    const db = req.db;

    // -------------------------
    // PHONE OTP FLOW
    // -------------------------
    if (!email) {
      if (!phone_number) {
        return res
          .status(400)
          .json({ success: false, message: "phone_number missing" });
      }
      if (!countrycode) {
        return res
          .status(400)
          .json({ success: false, message: "countrycode missing" });
      }

      // Check if exists
      const selectQuery = `
        SELECT id FROM smt_login_otp 
        WHERE phone = ? AND countrycode = ?
      `;

      const rows = await new Promise((resolve, reject) => {
        db.query(selectQuery, [phone_number, countrycode], (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      if (rows.length > 0) {
        // Update
        const updateQuery = `
          UPDATE smt_login_otp 
          SET hash = ?, salt = ? 
          WHERE phone = ? AND countrycode = ?
        `;
        await new Promise((resolve, reject) => {
          db.query(
            updateQuery,
            [hash, salt, phone_number, countrycode],
            (err) => {
              if (err) reject(err);
              resolve();
            },
          );
        });
      } else {
        // Insert
        const insertQuery = `
          INSERT INTO smt_login_otp (phone, countrycode, hash, salt)
          VALUES (?, ?, ?, ?)
        `;
        await new Promise((resolve, reject) => {
          db.query(
            insertQuery,
            [phone_number, countrycode, hash, salt],
            (err) => {
              if (err) reject(err);
              resolve();
            },
          );
        });
      }
    }

    // -------------------------
    // EMAIL OTP FLOW
    // -------------------------
    else {
      const selectQuery = `
        SELECT id FROM smt_login_otp 
        WHERE email_id = ?
      `;

      const rows = await new Promise((resolve, reject) => {
        db.query(selectQuery, [email], (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });

      if (rows.length > 0) {
        const updateQuery = `
          UPDATE smt_login_otp 
          SET hash = ?, salt = ?
          WHERE email_id = ?
        `;

        await new Promise((resolve, reject) => {
          db.query(updateQuery, [hash, salt, email], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
      } else {
        const insertQuery = `
          INSERT INTO smt_login_otp (email_id, hash, salt) 
          VALUES (?, ?, ?)
        `;

        await new Promise((resolve, reject) => {
          db.query(insertQuery, [email, hash, salt], (err) => {
            if (err) reject(err);
            resolve();
          });
        });
      }
    }

    // SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      message: "OTP sent",
      datas: [{ otp }], // remove OTP in production
    });
  } catch (error) {
    console.error("Error in sendOTP:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const countryswith = async (req, res) => {
  const db = req.db;
  const { country_code } = req.body; // or req.query

  if (!country_code) {
    return res.status(400).json({
      success: false,
      message: "country_code is required",
      datas: [],
    });
  }

  try {
    const query = `
        SELECT 
          country_id,
          currency_code,
          phone_code,
          name
        FROM smt_country
        WHERE iso_code_2 = ?
        LIMIT 1
      `;

    const result = await new Promise((resolve, reject) => {
      db.query(query, [country_code.toUpperCase()], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Currency not found for this country",
        datas: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Currency fetched successfully",
      datas: result,
    });
  } catch (error) {
    console.error("getCurrencyByCountry error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

export const verifyLogin = async (req, res) => {
  if (!req.body) {
    return res
      .status(400)
      .json({ success: false, message: "All input are missing", datas: [] });
  }

  const db = req.db; // mysql connection
  const { email, phone_number, countrycode, otp, password } = req.body;

  let check_type = "";

  if (!otp) {
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "otp or password missing",
        datas: [],
      });
    }
    check_type = "password";
  } else {
    check_type = "otp";
  }

  let result;

  // ============================================================
  // CHECK TYPE = PASSWORD LOGIN
  // ============================================================
  if (check_type === "password") {
    if (!email) {
      if (!phone_number) {
        return res
          .status(400)
          .json({ success: false, message: "phone_number missing", datas: [] });
      }
      if (!countrycode) {
        return res
          .status(400)
          .json({ success: false, message: "countrycode missing", datas: [] });
      }

      const query =
        "SELECT id, group_id, first_name, last_name, email_id, phone, country_code, hash, salt FROM smt_users WHERE phone = ? AND country_code = ?";
      result = await new Promise((resolve, reject) => {
        db.query(query, [phone_number, countrycode], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    } else {
      const query =
        "SELECT id, group_id, first_name, last_name, email_id, phone, country_code, hash, salt FROM smt_users WHERE email_id = ?";
      result = await new Promise((resolve, reject) => {
        db.query(query, [email], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    }

    if (result.length > 0) {
      if (!result[0].salt || !result[0].hash) {
        return res.status(400).json({
          success: false,
          message: "Password not matched",
          datas: [],
        });
      }
      const isValid = validPassword(password, result[0].salt, result[0].hash);

      if (isValid) {
        const userdet = {
          first_name: result[0].first_name ? result[0].first_name : "Traveller",
          last_name: result[0].last_name,
          email_id: result[0].email_id,
          phone: result[0].phone,
          countrycode: result[0].country_code,
        };

        let token = generateJwt(result[0].id, result[0].group_id);

        return res.status(200).json({
          success: true,
          message: "Password Matched",
          datas: [{ token, userdet }],
        });
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Password is wrong", datas: [] });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "User info not matched", datas: [] });
    }
  }

  // ============================================================
  //  CHECK TYPE = OTP LOGIN
  // ============================================================
  if (check_type === "otp") {
    if (!email) {
      if (!phone_number) {
        return res
          .status(400)
          .json({ success: false, message: "phone_number missing", datas: [] });
      }
      if (!countrycode) {
        return res
          .status(400)
          .json({ success: false, message: "countrycode missing", datas: [] });
      }

      const query =
        "SELECT hash, salt FROM smt_login_otp WHERE phone = ? AND countrycode = ?";
      result = await new Promise((resolve, reject) => {
        db.query(query, [phone_number, countrycode], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    } else {
      const query = "SELECT hash, salt FROM smt_login_otp WHERE email_id = ?";
      result = await new Promise((resolve, reject) => {
        db.query(query, [email], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    }

    // Check OTP
    if (result.length > 0) {
      const isValid = validPassword(
        "smt" + otp,
        result[0].salt,
        result[0].hash,
      );

      if (isValid) {
        let ret_id = 0;
        var userdetail = {};
        // ---------------------------------------
        // Fetch or Insert User
        // ---------------------------------------
        if (!email) {
          const query =
            "SELECT id, group_id, email_id, first_name, last_name, phone, country_code FROM smt_users WHERE phone = ? AND country_code = ?";
          const users = await new Promise((resolve, reject) => {
            db.query(query, [phone_number, countrycode], (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            });
          });

          if (users.length === 0) {
            // Insert new user
            const insertQuery =
              "INSERT INTO smt_users (group_id, phone, country_code) VALUES (?, ?, ?)";
            const insertResult = await new Promise((resolve, reject) => {
              db.query(
                insertQuery,
                [3, phone_number, countrycode],
                (err, rows) => {
                  if (err) reject(err);
                  resolve(rows);
                },
              );
            });

            ret_id = insertResult.insertId;
            userdetail.first_name = "Traveller";
            userdetail.last_name = "";
            userdetail.email_id = "";
            userdetail.phone = phone_number;
            userdetail.countrycode = countrycode;
          } else {
            ret_id = users[0].id;
            userdetail.first_name = users[0].first_name
              ? users[0].first_name
              : "Traveller";
            userdetail.last_name = users[0].last_name;
            userdetail.email_id = users[0].email_id;
            userdetail.phone = users[0].phone;
            userdetail.countrycode = users[0].country_code;
          }
        } else {
          const query =
            "SELECT id, group_id, email_id, first_name, last_name, phone, country_code FROM smt_users WHERE email_id = ?";
          const users = await new Promise((resolve, reject) => {
            db.query(query, [email], (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            });
          });

          if (users.length === 0) {
            // Insert new user
            const insertQuery =
              "INSERT INTO smt_users (group_id, email_id) VALUES (?, ?)";
            const insertResult = await new Promise((resolve, reject) => {
              db.query(insertQuery, [3, email], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
              });
            });

            ret_id = insertResult.insertId;

            userdetail.first_name = "Traveller";
            userdetail.last_name = "";
            userdetail.email_id = email;
            userdetail.phone = "";
            userdetail.countrycode = "";
          } else {
            ret_id = users[0].id;

            userdetail.first_name = users[0].first_name
              ? users[0].first_name
              : "Traveller";
            userdetail.last_name = users[0].last_name;
            userdetail.email_id = users[0].email_id;
            userdetail.phone = users[0].phone;
            userdetail.countrycode = users[0].country_code;
          }
        }

        // Generate Token
        let token = generateJwt(ret_id, 3);

        return res.status(200).json({
          success: true,
          message: "OTP Matched",
          datas: [{ token, userdetail }],
        });
      } else {
        return res
          .status(400)
          .json({ success: false, message: "OTP is not matched", datas: [] });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Record not found", datas: [] });
    }
  }
};

export const sendResetPassword = async (req, res) => {
  var otp = getRandomInt(100000, 999999);
  const { salt, hash } = getPassword("smt" + otp);

  if (!req.body) {
    return res
      .status(400)
      .json({ success: false, message: "All input are missing", datas: [] });
  }

  const { email, phone_number, countrycode } = req.body;
  const db = req.db; // <-- MySQL connection

  let getusers;

  try {
    // ---------------------------------------------
    // CHECK USER EXISTS
    // ---------------------------------------------
    if (!email) {
      if (!phone_number) {
        return res
          .status(400)
          .json({ success: false, message: "phone_number missing", datas: [] });
      }
      if (!countrycode) {
        return res
          .status(400)
          .json({ success: false, message: "countrycode missing", datas: [] });
      }

      const query = `SELECT id FROM smt_users WHERE phone = ? AND country_code = ?`;
      getusers = await new Promise((resolve, reject) => {
        db.query(query, [phone_number, countrycode], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    } else {
      const query = `SELECT id FROM smt_users WHERE email_id = ?`;
      getusers = await new Promise((resolve, reject) => {
        db.query(query, [email], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    }
    console.log(getusers);
    // ---------------------------------------------
    // USER NOT FOUND → SEND OTP
    // ---------------------------------------------
    if (getusers.length > 0) {
      // ---------------- SMS OTP ----------------
      if (!email) {
        const selectQuery = `SELECT id FROM smt_login_otp WHERE phone = ? AND countrycode = ?`;

        const result = await new Promise((resolve, reject) => {
          db.query(selectQuery, [phone_number, countrycode], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
          });
        });

        if (result.length > 0) {
          const updateQuery = `UPDATE smt_login_otp SET hash = ?, salt = ? WHERE phone = ? AND countrycode = ?`;
          await new Promise((resolve, reject) => {
            db.query(
              updateQuery,
              [hash, salt, phone_number, countrycode],
              (err) => {
                if (err) reject(err);
                resolve();
              },
            );
          });
        } else {
          const insertQuery = `INSERT INTO smt_login_otp (phone, countrycode, hash, salt) VALUES (?, ?, ?, ?)`;
          await new Promise((resolve, reject) => {
            db.query(
              insertQuery,
              [phone_number, countrycode, hash, salt],
              (err) => {
                if (err) reject(err);
                resolve();
              },
            );
          });
        }

        return res.status(200).json({
          success: true,
          message: "OTP sent",
          datas: [{ otp, phone_number, countrycode }],
        });
      }

      // ---------------- EMAIL OTP ----------------
      else {
        const selectQuery = `SELECT id FROM smt_login_otp WHERE email_id = ?`;

        const result = await new Promise((resolve, reject) => {
          db.query(selectQuery, [email], (err, rows) => {
            if (err) reject(err);
            resolve(rows);
          });
        });

        if (result.length > 0) {
          const updateQuery = `UPDATE smt_login_otp SET hash = ?, salt = ? WHERE email_id = ?`;
          await new Promise((resolve, reject) => {
            db.query(updateQuery, [hash, salt, email], (err) => {
              if (err) reject(err);
              resolve();
            });
          });
        } else {
          const insertQuery = `INSERT INTO smt_login_otp (email_id, hash, salt) VALUES (?, ?, ?)`;
          await new Promise((resolve, reject) => {
            db.query(insertQuery, [email, hash, salt], (err) => {
              if (err) reject(err);
              resolve();
            });
          });
        }

        return res.status(200).json({
          success: true,
          message: "OTP sent",
          datas: [{ otp, email }],
        });
      }
    }

    // ---------------------------------------------
    // USER FOUND → ERROR
    // ---------------------------------------------
    return res.status(400).json({
      success: false,
      message: "No User Found",
      datas: [],
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: [],
    });
  }
};

export const verifyResetPassword = async (req, res) => {
  if (!req.body) {
    return res
      .status(400)
      .json({ success: false, message: "All input are missing", datas: [] });
  }

  const db = req.db;
  const { email, phone_number, countrycode, otp } = req.body;

  let result;

  // ---------------------------
  // Validate input
  // ---------------------------
  if (!email) {
    if (!phone_number) {
      return res
        .status(400)
        .json({ success: false, message: "phone_number missing", datas: [] });
    }

    if (!countrycode) {
      return res
        .status(400)
        .json({ success: false, message: "countrycode missing", datas: [] });
    }

    result = await new Promise((resolve, reject) => {
      db.query(
        `SELECT hash, salt FROM smt_login_otp WHERE phone = ? AND countrycode = ?`,
        [phone_number, countrycode],
        (err, rows) => (err ? reject(err) : resolve(rows)),
      );
    });
  } else {
    result = await new Promise((resolve, reject) => {
      db.query(
        `SELECT hash, salt FROM smt_login_otp WHERE email_id = ?`,
        [email],
        (err, rows) => (err ? reject(err) : resolve(rows)),
      );
    });
  }

  // ---------------------------
  // OTP Check
  // ---------------------------
  if (result.length === 0) {
    return res
      .status(400)
      .json({ success: false, message: "Record not found", datas: [] });
  }

  const isValid = validPassword("smt" + otp, result[0].salt, result[0].hash);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "OTP is not matched",
      datas: [],
    });
  }

  // ---------------------------
  // Fetch User
  // ---------------------------
  let getusers;

  if (!email) {
    getusers = await new Promise((resolve, reject) => {
      db.query(
        `SELECT id, group_id, email_id, first_name, last_name, phone, country_code 
         FROM smt_users WHERE phone = ? AND country_code = ?`,
        [phone_number, countrycode],
        (err, rows) => (err ? reject(err) : resolve(rows)),
      );
    });
  } else {
    getusers = await new Promise((resolve, reject) => {
      db.query(
        `SELECT id, group_id, phone, country_code, first_name, last_name, email_id 
         FROM smt_users WHERE email_id = ?`,
        [email],
        (err, rows) => (err ? reject(err) : resolve(rows)),
      );
    });
  }

  // -------------------------------------
  // FIXED: Correct condition (your code had reversed logic)
  // -------------------------------------
  if (getusers.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No User Found",
      datas: [],
    });
  }

  // ---------------------------
  // Prepare user data
  // ---------------------------
  const user = getusers[0];

  const userdet = {
    first_name: user.first_name || "Traveller",
    last_name: user.last_name || "",
    email_id: user.email_id || "",
    phone: user.phone || "",
    countrycode: user.country_code || "",
  };

  const token = generateJwt(user.id, user.group_id);

  return res.status(200).json({
    success: true,
    message: "OTP Matched",
    datas: [{ token, userdet }],
  });
};

export const setpasswordfromlogin = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: "All input are missing",
      datas: [],
    });
  }

  const db = req.db; // MySQL connection
  const userId = req.userId;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: "password missing",
      datas: [],
    });
  }

  const { salt, hash } = getPassword(password);

  const updateQuery = `
    UPDATE smt_users 
    SET hash = ?, salt = ? 
    WHERE id = ?
  `;

  try {
    await new Promise((resolve, reject) => {
      db.query(updateQuery, [hash, salt, userId], (err, result) => {
        if (err) reject(err);
        resolve(result);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Password updated",
      datas: [],
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// UPDATE USER PROFILE

export const updateUserProfile = async (req, res) => {
  const db = req.db;

  try {
    const userId = req.userId;

    if (!userId) {
      // Remove newly uploaded image if user is not authenticated
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

      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const body = req.body || {};

    // --------------------------------------------------------------
    // Get existing user
    // --------------------------------------------------------------

    const existing = await new Promise((resolve, reject) => {
      db.query(
        `
          SELECT
            id,
            profile
          FROM smt_users
          WHERE id = ?
            AND deleted = 0
          LIMIT 1
        `,
        [userId],
        (err, results) => {
          if (err) {
            return reject(err);
          }

          resolve(results);
        },
      );
    });

    if (existing.length === 0) {
      // User does not exist.
      // Remove newly uploaded image if any.
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

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const current = existing[0];

    const fields = [];
    const values = [];

    // --------------------------------------------------------------
    // Basic fields
    // --------------------------------------------------------------

    if (body.first_name !== undefined) {
      fields.push("first_name = ?");
      values.push(body.first_name);
    }

    if (body.last_name !== undefined) {
      fields.push("last_name = ?");
      values.push(body.last_name);
    }

    if (body.gender !== undefined) {
      fields.push("gender = ?");
      values.push(body.gender);
    }

    if (body.dob !== undefined) {
      fields.push("dob = ?");
      values.push(body.dob);
    }

    if (body.marital_status !== undefined) {
      fields.push("marital_status = ?");
      values.push(body.marital_status);
    }

    if (body.country !== undefined) {
      fields.push("country = ?");
      values.push(body.country);
    }

    if (body.state !== undefined) {
      fields.push("state = ?");
      values.push(body.state);
    }

    if (body.city !== undefined) {
      fields.push("city = ?");
      values.push(body.city);
    }

    // --------------------------------------------------------------
    // Passport fields
    // --------------------------------------------------------------

    if (body.passport_number !== undefined) {
      fields.push("passport_number = ?");
      values.push(body.passport_number);
    }

    if (body.passport_exp_date !== undefined) {
      fields.push("passport_exp_date = ?");
      values.push(body.passport_exp_date || null);
    }

    if (body.passport_issue_country !== undefined) {
      fields.push("passport_issue_country = ?");
      values.push(body.passport_issue_country || null);
    }

    // --------------------------------------------------------------
    // Special ID fields
    // --------------------------------------------------------------

    if (body.spl_id_type !== undefined) {
      fields.push("spl_id_type = ?");
      values.push(body.spl_id_type || null);
    }

    if (body.spl_id_number !== undefined) {
      fields.push("spl_id_number = ?");
      values.push(body.spl_id_number || null);
    }

    // --------------------------------------------------------------
    // Profile image
    // --------------------------------------------------------------

    if (req.file) {
      fields.push("profile = ?");

      values.push(`/public/customers/${req.file.filename}`);
    }

    // --------------------------------------------------------------
    // No changes
    // --------------------------------------------------------------

    if (fields.length === 0) {
      // If an image was uploaded but there are no DB fields,
      // remove the unused image.
      if (req.file) {
        try {
          const filePath = path.join("public", "customers", req.file.filename);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.error("Unused image cleanup error:", fileError);
        }
      }

      return res.status(400).json({
        success: false,
        message: "No fields provided for update",
      });
    }

    // --------------------------------------------------------------
    // Update database
    // --------------------------------------------------------------

    values.push(userId);

    await new Promise((resolve, reject) => {
      db.query(
        `
          UPDATE smt_users
          SET ${fields.join(", ")}
          WHERE id = ?
            AND deleted = 0
        `,
        values,
        (err, result) => {
          if (err) {
            return reject(err);
          }

          resolve(result);
        },
      );
    });

    // --------------------------------------------------------------
    // Delete OLD profile image
    //
    // Only delete after successful DB update.
    // --------------------------------------------------------------

    if (req.file && current.profile) {
      try {
        deleteProfileImage(current.profile);
      } catch (fileError) {
        console.error("Old profile image deletion error:", fileError);
      }
    }

    // --------------------------------------------------------------
    // Success
    // --------------------------------------------------------------

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      datas: [],
    });
  } catch (error) {
    // --------------------------------------------------------------
    // DB update failed.
    //
    // Delete newly uploaded image because it is not being used.
    // --------------------------------------------------------------

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

    console.error("updateUserProfile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// GET USER PROFILE

export const getUserProfile = async (req, res) => {
  const db = req.db;

  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const query = `
      SELECT
        first_name,
        last_name,
        gender,
        dob,
        marital_status,
        country,
        state,
        city,
        phone,
        country_code,
        email_id,
        passport_number,
        passport_exp_date,
        passport_issue_country,
        spl_id_type,
        spl_id_number,
        profile
      FROM smt_users
      WHERE id = ?
        AND deleted = 0
      LIMIT 1
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, result) => {
        if (err) {
          return reject(err);
        }

        resolve(result);
      });
    });

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = rows[0];

    // --------------------------------------------------------------
    // Build full profile image URL
    // --------------------------------------------------------------

    if (user.profile) {
      const profilePath = String(user.profile).replace(/^\/+/, "");

      user.profile = `${Config.baseurl.replace(/\/+$/, "")}/${profilePath}`;
    } else {
      user.profile = null;
    }

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
