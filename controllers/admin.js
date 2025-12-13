
import config from '../config.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
//import path from 'path';
//import fs from 'fs';
//import axios from 'axios';
//import moment from 'moment';

function getPassword(password = 'nativeappstech') {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function generateJwt(id, group_id, email_id) {
  return jwt.sign(
    { id, group_id, email_id},
    config.secret,
    { expiresIn: '1d' }
  );
}

function validPassword(password, salt, hashFromDB) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === hashFromDB;
}


// export const verifyLogin = async (req, res) => { 
//   if (!req.body) {
//     return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//   }
//   const pool = getPool();
//   const { email, password } = req.body;
 
//   let result;

//   const query = 'SELECT id FROM smt_users WHERE email_id = $1';
//   result = await pool.query(query, [email]);

//   if (result.rows.length > 0) {
//     const isValid = validPassword(password, result.rows[0].salt, result.rows[0].hash);
//     if(isValid){

//       var userdet = {
//                 'first_name' : result.rows[0].first_name,
//                 'last_name' : result.rows[0].last_name,
//                 'email_id' : result.rows[0].email_id,
//                 'phone' : result.rows[0].phone,
//                 'countrycode' : result.rows[0].country_code
//              };
//       let token = generateJwt(result.rows[0].id, result.rows[0].group_id, result.rows[0].email_id);
//       return res.status(200).json({ 'success': true, 'message': 'Authenticated', "datas": [{'token':token, userdet}] });

//     }else{
//        return res.status(400).json({ 'success': false, 'message': 'Password is wrong', "datas": [] });
//     }
//   }else{
//     return res.status(400).json({ 'success': false, 'message': '', "datas": [] });
//   }
// }

export const verifyLogin = async (req, res) => { 
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'All input are missing',
      datas: []
    });
  }

  const db = req.db;   // MySQL connection
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email is missing',
      datas: []
    });
  }

  try {
    // Fetch user
    const query = `
      SELECT 
        id, 
        first_name, 
        last_name, 
        email_id, 
        phone, 
        country_code,
        hash, 
        salt,
        group_id
      FROM smt_users 
      WHERE email_id = ?
      LIMIT 1
    `;

    const results = await new Promise((resolve, reject) => {
      db.query(query, [email], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (!results || results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
        datas: []
      });
    }

    const user = results[0];

    // FIX YOUR CONDITION
    // ❌ if (user.group_id!=1 || user.group_id!=2)
    // This ALWAYS becomes true
    // Why? Because if group_id=1, it's NOT 2 → TRUE
    // If group_id=2, it's NOT 1 → TRUE

    // ✔ Correct version:
    if (user.group_id !== 1 && user.group_id !== 2) {
      return res.status(400).json({
        success: false,
        message: 'User not found',
        datas: []
      });
    }

    // Check password fields
    if (!user.salt || !user.hash) {
      return res.status(400).json({
        success: false,
        message: 'Password not set for this user',
        datas: []
      });
    }

    // Validate password
    const isValid = validPassword(password, user.salt, user.hash);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Password is wrong',
        datas: []
      });
    }

    // User details
    const userdet = {
      first_name: user.first_name,
      last_name: user.last_name,
      email_id: user.email_id,
      phone: user.phone,
      countrycode: user.country_code,
      profile:user.profile
        ? `${config.baseurl}${user.profile}`
        : config.fileurl + 'user/default_profile.png',
    };

    // Token
    const token = generateJwt(user.id, user.group_id, user.email_id);

    return res.status(200).json({
      success: true,
      message: 'Authenticated',
      datas: [{ token, userdet }]
    });

  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      datas: []
    });
  }
};



// export const setpassword = async (req, res) => {
//   if (!req.body) {
//     return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//   }

//   let userid = req.userId;
//   const pool = getPool();
//   const { password } = req.body; 
//   if (!password) {
//     return res.status(400).json({ success: false, message: 'password missing', datas: [] });
//   }
//   const { salt, hash } = getPassword(password);
//   console.log(salt);
//   console.log(hash); 
//   const updateQuery = 'UPDATE smt_users SET hash = $1, salt = $2 WHERE id = $3';
//   await pool.query(updateQuery, [hash, salt, userid]);

//   return res.status(200).json({
//             success: true,
//             message: 'Password updated',
//             datas: [] 
//         });

// }

export const setpassword = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'All input are missing',
      datas: []
    });
  }

  const db = req.db;
  const userId = req.userId;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'password missing',
      datas: []
    });
  }

  const { salt, hash } = getPassword(password);

  try {
    const updateQuery = `
      UPDATE smt_users 
      SET hash = ?, salt = ?
      WHERE id = ?
    `;

    await new Promise((resolve, reject) => {
      db.query(updateQuery, [hash, salt, userId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    return res.status(200).json({
      success: true,
      message: 'Password updated',
      datas: []
    });

  } catch (error) {
    console.error("Error updating password:", error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      datas: []
    });
  }
};


