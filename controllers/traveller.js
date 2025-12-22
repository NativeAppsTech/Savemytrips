//import getPool from '../db.js';
import config from '../config.js';

export const addCoTraveller = async (req, res) => {
  const db = req.db;

  try {
    const {
      first_name,
      last_name,
      gender,
      dob,
      country,
      relationship,
      meals_prefer,
      passport_number,
      passport_exp_date,
      passport_issue_country,
      phone_code,
      phone,
      email
    } = req.body;

    // -----------------------------
    // BASIC VALIDATION
    // -----------------------------
    if (!first_name) {
      return res.status(400).json({
        success: false,
        message: "First name is required"
      });
    }

    if (!last_name) {
      return res.status(400).json({
        success: false,
        message: "Last name is required"
      });
    }

    if (!dob) {
      return res.status(400).json({
        success: false,
        message: "DOB is required"
      });
    }

    if (!gender) {
      return res.status(400).json({
        success: false,
        message: "Gender is required"
      });
    }

    // -----------------------------
    // INSERT QUERY
    // -----------------------------
    const insertQuery = `
      INSERT INTO smt_co_traveller (
        user_id,
        first_name,
        last_name,
        gender,
        dob,
        country,
        relationship,
        meals_prefer,
        passport_number,
        passport_exp_date,
        passport_issue_country,
        phone_code,
        phone,
        email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      req.userId,                     // 👈 logged-in user
      first_name.trim(),
      last_name.trim(),
      gender || null,
      dob || null,
      country || null,
      relationship || null,
      meals_prefer || null,
      passport_number || null,
      passport_exp_date || null,
      passport_issue_country || null,
      phone_code || null,
      phone || null,
      email || null
    ];

    const result = await new Promise((resolve, reject) => {
      db.query(insertQuery, values, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Co-traveller added successfully",
      co_traveller_id: result.insertId
    });

  } catch (error) {
    console.error("Add co-traveller error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

export const listCoTravellers = async (req, res) => {
  const db = req.db;

  try {
    const userId = req.userId;

    const query = `
      SELECT
        id,
        first_name,
        last_name,
        gender,
        dob,
        country,
        relationship,
        meals_prefer,
        passport_number,
        passport_exp_date,
        passport_issue_country,
        phone_code,
        phone,
        email
      FROM smt_co_traveller
      WHERE user_id = ?
        AND deleted = 0
      ORDER BY id DESC
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, [userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Co-travellers fetched successfully",
      total: rows.length,
      datas: rows
    });

  } catch (error) {
    console.error("List co-travellers error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

export const updateCoTraveller = async (req, res) => {
  const db = req.db;

  try {
    const userId = req.userId;
    const { id } = req.params; // co_traveller id

    const {
      first_name,
      last_name,
      gender,
      dob,
      country,
      relationship,
      meals_prefer,
      passport_number,
      passport_exp_date,
      passport_issue_country,
      phone_code,
      phone,
      email
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Co-traveller id is required"
      });
    }

    const query = `
      UPDATE smt_co_traveller
      SET
        first_name = ?,
        last_name = ?,
        gender = ?,
        dob = ?,
        country = ?,
        relationship = ?,
        meals_prefer = ?,
        passport_number = ?,
        passport_exp_date = ?,
        passport_issue_country = ?,
        phone_code = ?,
        phone = ?,
        email = ?
      WHERE id = ?
        AND user_id = ?
        AND deleted = 0
    `;

    const values = [
      first_name,
      last_name,
      gender,
      dob,
      country,
      relationship,
      meals_prefer || null,
      passport_number,
      passport_exp_date || null,
      passport_issue_country || null,
      phone_code,
      phone || null,
      email,
      id,
      userId
    ];

    const result = await new Promise((resolve, reject) => {
      db.query(query, values, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Co-traveller not found or not authorized"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Co-traveller updated successfully"
    });

  } catch (error) {
    console.error("Update co-traveller error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


