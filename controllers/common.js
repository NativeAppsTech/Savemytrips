//import getPool from '../db.js';
import config from '../config.js';


export const listCountries = async (req, res) => {
  const db = req.db;

  try {
    const query = `
      SELECT
        country_id,
        name,
        iso_code_2
      FROM smt_country
      WHERE status = 1
      ORDER BY name ASC
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Countries fetched successfully",
      total: rows.length,
      datas: rows
    });

  } catch (error) {
    console.error("List countries error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


export const listZonesByCountry = async (req, res) => {
  const db = req.db;

  try {
    const { country_id } = req.query;

    if (!country_id) {
      return res.status(400).json({
        success: false,
        message: "country_id is required"
      });
    }

    const query = `
      SELECT
        zone_id,
        country_id,
        name,
        code
      FROM smt_zone
      WHERE status = 1
        AND country_id = ?
      ORDER BY name ASC
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, [country_id], (err, results) => {
        if (err) return reject(err);
        resolve(results);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Zones fetched successfully",
      total: rows.length,
      datas: rows
    });

  } catch (error) {
    console.error("List zones error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


export const listSpecialCountryUserIds = async (req, res) => {
  const db = req.db;

  try {
    const { country_id } = req.query; // or req.body

    if (!country_id) {
      return res.status(400).json({
        success: false,
        message: "country_id is required"
      });
    }

    const query = `
      SELECT
        id,
        title,
        country_id
      FROM smt_special_country_user_id
      WHERE country_id = ?
    `;

    const rows = await new Promise((resolve, reject) => {
      db.query(query, [country_id], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(200).json({
      success: true,
      message: "Special ID list fetched successfully",
      datas: rows
    });

  } catch (error) {
    console.error("Special country ID list error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};