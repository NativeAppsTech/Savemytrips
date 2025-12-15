//import getPool from '../db.js';
import config from '../config.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
//import path from 'path';
//import fs from 'fs';
//import axios from 'axios';
//import moment from 'moment';

function getRandomInt(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

function getPassword(password = 'nativeappstech') {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function generateJwt(id, group_id) {
  return jwt.sign(
    { id, group_id},
    config.secret,
    { expiresIn: '7d' }
  );
}

function validPassword(password, salt, hashFromDB) {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === hashFromDB;
}

// export const sendOTP = async (req, res) => { 
//     var otp = getRandomInt(100000, 999999);
//     const { salt, hash } = getPassword('smt'+otp);
//     var send=1;
//     //if(send){
//     if (!req.body) {
//       return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//     }

//     const { email, phone_number, countrycode } = req.body;
//     const db = req.db;
//     if (!email) {
//       console.log('hhhhhhhhhh');
//       if (!phone_number) {
//         return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
//       }

//       if (!countrycode) {
//         return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
//       }
//       // send sms functionality
//       const query = 'SELECT id FROM smt_login_otp WHERE phone = $1 AND countrycode = $2';
//       const result = await db.query(query, [req.body.phone_number, req.body.countrycode]);
//       if (result.rows.length > 0) {
//          console.log('here');
//          const updateQuery = 'UPDATE smt_login_otp SET hash = $1, salt = $2 WHERE phone = $3 AND countrycode = $4';
//          await db.query(updateQuery, [hash, salt, req.body.phone_number, req.body.countrycode]);
//       }else{
//          console.log('there');
//          const insertQuery = 'INSERT INTO smt_login_otp (phone, countrycode, hash, salt) VALUES ($1, $2, $3, $4)';
//          await db.query(insertQuery, [req.body.phone_number, req.body.countrycode, hash, salt]);
//       }
//     }else{
//       console.log('gggggggggggggg');
//       // send email functionality
//       const query = 'SELECT id FROM smt_login_otp WHERE email_id = $1';
//       const result = await db.query(query, [req.body.email]);
//       if (result.rows.length > 0) {
//          const updateQuery = 'UPDATE smt_login_otp SET hash = $1, salt = $2 WHERE email_id = $3';
//          await db.query(updateQuery, [hash, salt, email]);
//       }else{
//         const insertQuery = 'INSERT INTO smt_login_otp (email_id, hash, salt) VALUES ($1, $2, $3)';
//         await db.query(insertQuery, [email, hash, salt]);
//       }
//     }

//     return res.status(200).json({
//             success: true,
//             message: 'OTP sent',
//             datas: [{ "otp":otp }] // remove in production
//           });
// }

export const checkPhoneExists = async (phone, country_code, db) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT id FROM smt_users WHERE phone = ? AND country_code = ? LIMIT 1`;

    db.query(query, [phone, country_code], (err, results) => {
      if (err) return reject(err);

      if (results.length > 0) {
        resolve(true);   //  found
      } else {
        resolve(false);  //  not found
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
        resolve(true);   // email found
      } else {
        resolve(false);  // email not found
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
      datas: []
    });
  }

  try {
    const exists = await checkEmailExists(email, db);

    return res.status(200).json({
      success: true,
      exists: exists
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: []
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
      datas: []
    });
  }

    if (!country_code) {
    return res.status(400).json({
      success: false,
      message: "country code missing",
      datas: []
    });
  }
  try {
    const exists = await checkPhoneExists(phone, country_code, db);

    return res.status(200).json({
      success: true,
      exists: exists
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: []
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
        message: "All input missing"
      });
    }

    const { email, phone_number, countrycode } = req.body;
    const db = req.db;

    // -------------------------
    // PHONE OTP FLOW
    // -------------------------
    if (!email) {
      if (!phone_number) {
        return res.status(400).json({ success: false, message: "phone_number missing" });
      }
      if (!countrycode) {
        return res.status(400).json({ success: false, message: "countrycode missing" });
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
          db.query(updateQuery, [hash, salt, phone_number, countrycode], (err) => {
            if (err) reject(err);
            resolve();
          });
        });

      } else {
        // Insert
        const insertQuery = `
          INSERT INTO smt_login_otp (phone, countrycode, hash, salt)
          VALUES (?, ?, ?, ?)
        `;
        await new Promise((resolve, reject) => {
          db.query(insertQuery, [phone_number, countrycode, hash, salt], (err) => {
            if (err) reject(err);
            resolve();
          });
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
      error: error.message
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
        datas: []
      });
    }
  
    try {
      const query = `
        SELECT 
          id,
          currency_code,
          phone_code,
          country
        FROM smt_currencies
        WHERE country_code = ?
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
          datas: []
        });
      }
  
      return res.status(200).json({
        success: true,
        message: "Currency fetched successfully",
        datas: result
      });
  
    } catch (error) {
      console.error("getCurrencyByCountry error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
        datas: []
      });
    }


};

// export const verifyLogin = async (req, res) => { 
//   if (!req.body) {
//     return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//   }
//   const pool = getPool();
//   const { email, phone_number, countrycode, otp, password } = req.body;
//   let check_type="";
//   if (!otp) {
//       if (!password) {
//         return res.status(400).json({ success: false, message: 'otp or password missing', datas: [] });
//       }
//       check_type = "password";
//   }else{
//       check_type = "otp";
//   }
  
//   let result;
//   if(check_type=="password"){
//     // if they send password
    
//     if (!email) {
//       if (!phone_number) {
//         return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
//       }

//       if (!countrycode) {
//         return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
//       }
//       console.log('hhhhhhh');
//       const query = 'SELECT hash, salt FROM smt_users WHERE phone = $1 AND country_code = $2';
//       result = await pool.query(query, [phone_number, countrycode]);
//       console.log(result);
//     }else{
//       console.log('eeeeeeee');
//       const query = 'SELECT hash, salt FROM smt_users WHERE email_id = $1';
//       result = await pool.query(query, [email]);
//     }
//     console.log(result);
//     if (result.rows.length > 0) {
//        const isValid = validPassword(password, result.rows[0].salt, result.rows[0].hash);
//        if (isValid) {
//              var userdet = {
//                 'first_name' : result.rows[0].first_name,
//                 'last_name' : result.rows[0].last_name,
//                 'email_id' : result.rows[0].email_id,
//                 'phone' : result.rows[0].phone,
//                 'countrycode' : result.rows[0].country_code
//              };
//              let token = generateJwt(result.rows[0].id, result.rows[0].group_id);
//              return res.status(200).json({ 'success': true, 'message': 'OTP Matched', "datas": [{'token':token, userdet}] });
//        }else{
//           return res.status(400).json({ 'success': false, 'message': 'Password is wrong', "datas": [] });
//        }
//     }else{
//         return res.status(400).json({ 'success': false, 'message': 'User info not matched', "datas": [] });
//     }
//   }else{
//     // if it is OTP
//     if (!email) {
//       if (!phone_number) {
//         return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
//       }

//       if (!countrycode) {
//         return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
//       }
//       const query = 'SELECT hash, salt FROM smt_login_otp WHERE phone = $1 AND countrycode = $2';
//       result = await pool.query(query, [phone_number, countrycode]);
//     }else{
//       const query = 'SELECT hash, salt FROM smt_login_otp WHERE email_id = $1';
//       result = await pool.query(query, [email]);
//     }

//     if (result.rows.length > 0) {
//         const isValid = validPassword('smt'+otp, result.rows[0].salt, result.rows[0].hash);
//         if(isValid){
//             let ret_id=0;
//             let ret_group_id=3;
//             let ret_email="";
//             let ret_first_name="";
//             let ret_last_name="";
//             let ret_phone="";
//             let ret_countrycode="";
//             if (!email) {
//                const query = 'SELECT id, group_id, email_id, first_name, last_name FROM smt_users WHERE phone = $1 AND country_code = $2';
//                const getusers = await pool.query(query, [phone_number, countrycode]);
//                if (getusers.rows.length == 0) {
//                    // insert code 
//                    const insertQuery = 'INSERT INTO smt_users (group_id, phone, country_code, hash, salt) VALUES ($1, $2, $3, $4, $5) RETURNING id';
//                    const insertResult = await pool.query(insertQuery, [3, phone_number, countrycode, result.rows[0].hash, result.rows[0].salt]);
//                    const insertedId = insertResult.rows[0].id;
                   
//                    ret_email = "";
//                    ret_first_name = "";
//                    ret_last_name = "";
//                    ret_id=insertedId;
//                    ret_group_id=3;
//                }else{
//                    ret_email = getusers.rows[0].email_id;
//                    ret_first_name = getusers.rows[0].first_name;
//                    ret_last_name = getusers.rows[0].last_name;
//                    ret_id=getusers.rows[0].id;
//                    ret_group_id=3;
//                }
              
//                 var userdet = {
//                  'first_name' : ret_first_name,
//                  'last_name' : ret_last_name,
//                  'email_id' : ret_email,
//                  'phone' : phone_number,
//                  'countrycode' : countrycode
//                };
//             }else{
//                const query = 'SELECT id, group_id, phone, country_code, first_name, last_name FROM smt_users WHERE email_id = $1';
//                const getusers = await pool.query(query, [email]);
//                if (getusers.rows.length == 0) {
//                    const insertQuery = 'INSERT INTO smt_users (group_id, email_id, hash, salt) VALUES ($1, $2, $3, $4) RETURNING id';
//                    const insertResult = await pool.query(insertQuery, [3, email, result.rows[0].hash, result.rows[0].salt]);
//                    const insertedId = insertResult.rows[0].id;
//                    ret_phone = "";
//                    ret_countrycode = "";
//                    ret_first_name = "";
//                    ret_last_name = "";
//                    //ret_email = email;
//                    ret_id=insertedId;
//                    ret_group_id=3;
//                }else{
//                    ret_phone = getusers.rows[0].phone;
//                    ret_countrycode = getusers.rows[0].country_code;
//                    //ret_email = email;
//                    ret_first_name = getusers.rows[0].first_name;
//                    ret_last_name = getusers.rows[0].last_name;
//                    ret_id=insertedId;
//                    ret_group_id=3;
//                }

//                var userdet = {
//                  'first_name' : ret_first_name,
//                  'last_name' : ret_last_name,
//                  'email_id' : email,
//                  'phone' : ret_phone,
//                  'countrycode' : ret_countrycode
//                };
//             }
//             let token = generateJwt(result.rows[0].id, result.rows[0].group_id);
//             return res.status(200).json({ 'success': true, 'message': 'OTP Matched', "datas": [{'token':token, userdet}] });
//         }else{
//            return res.status(400).json({ 'success': false, 'message': 'OTP is not matched', "datas": [] });
//         }
//     }else{
//        return res.status(400).json({ 'success': false, 'message': 'Record not found', "datas": [] });
//     }
//   }
// }

export const verifyLogin = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
  }

  const db = req.db;  // mysql connection
  const { email, phone_number, countrycode, otp, password } = req.body;

  let check_type = "";

  if (!otp) {
    if (!password) {
      return res.status(400).json({ success: false, message: 'otp or password missing', datas: [] });
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
        return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
      }
      if (!countrycode) {
        return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
      }

      const query = 'SELECT id, group_id, first_name, last_name, email_id, phone, country_code, hash, salt FROM smt_users WHERE phone = ? AND country_code = ?';
      result = await new Promise((resolve, reject) => {
        db.query(query, [phone_number, countrycode], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    } else {
      const query = 'SELECT id, group_id, first_name, last_name, email_id, phone, country_code, hash, salt FROM smt_users WHERE email_id = ?';
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
          message: 'Password not matched',
          datas: []
        });
      }
      const isValid = validPassword(password, result[0].salt, result[0].hash);

      if (isValid) {
        const userdet = {
          first_name: result[0].first_name ? result[0].first_name: 'Traveller',
          last_name: result[0].last_name,
          email_id: result[0].email_id,
          phone: result[0].phone,
          countrycode: result[0].country_code
        };

        let token = generateJwt(result[0].id, result[0].group_id);

        return res.status(200).json({
          success: true,
          message: 'Password Matched',
          datas: [{ token, userdet }]
        });
      } else {
        return res.status(400).json({ success: false, message: 'Password is wrong', datas: [] });
      }
    } else {
      return res.status(400).json({ success: false, message: 'User info not matched', datas: [] });
    }
  }

  // ============================================================
  //  CHECK TYPE = OTP LOGIN
  // ============================================================
  if (check_type === "otp") {
    if (!email) {
      if (!phone_number) {
        return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
      }
      if (!countrycode) {
        return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
      }

      const query = 'SELECT hash, salt FROM smt_login_otp WHERE phone = ? AND countrycode = ?';
      result = await new Promise((resolve, reject) => {
        db.query(query, [phone_number, countrycode], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });

    } else {
      const query = 'SELECT hash, salt FROM smt_login_otp WHERE email_id = ?';
      result = await new Promise((resolve, reject) => {
        db.query(query, [email], (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        });
      });
    }

    // Check OTP
    if (result.length > 0) {
      const isValid = validPassword('smt' + otp, result[0].salt, result[0].hash);

      if (isValid) {
        let ret_id = 0;
        var userdetail = {};
        // ---------------------------------------
        // Fetch or Insert User
        // ---------------------------------------
        if (!email) {
          const query = 'SELECT id, group_id, email_id, first_name, last_name, phone, country_code FROM smt_users WHERE phone = ? AND country_code = ?';
          const users = await new Promise((resolve, reject) => {
            db.query(query, [phone_number, countrycode], (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            });
          });

          if (users.length === 0) {
            // Insert new user
            const insertQuery = 'INSERT INTO smt_users (group_id, phone, country_code) VALUES (?, ?, ?)';
            const insertResult = await new Promise((resolve, reject) => {
              db.query(insertQuery, [3, phone_number, countrycode], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
              });
            });

            ret_id = insertResult.insertId;
            userdetail.first_name = 'Traveller';
            userdetail.last_name = '';
            userdetail.email_id = '';
            userdetail.phone = phone_number;
            userdetail.countrycode = countrycode;
          } else {
            ret_id = users[0].id;
            userdetail.first_name = users[0].first_name ? users[0].first_name: 'Traveller';
            userdetail.last_name = users[0].last_name;
            userdetail.email_id = users[0].email_id;
            userdetail.phone = users[0].phone;
            userdetail.countrycode = users[0].country_code;
          }
        }else{

          const query = 'SELECT id, group_id, email_id, first_name, last_name, phone, country_code FROM smt_users WHERE email_id = ?';
          const users = await new Promise((resolve, reject) => {
            db.query(query, [email], (err, rows) => {
              if (err) reject(err);
              resolve(rows);
            });
          });

          if (users.length === 0) {
            // Insert new user
            const insertQuery = 'INSERT INTO smt_users (group_id, email_id) VALUES (?, ?)';
            const insertResult = await new Promise((resolve, reject) => {
              db.query(insertQuery, [3, email], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
              });
            });

            ret_id = insertResult.insertId;

            userdetail.first_name = 'Traveller';
            userdetail.last_name = '';
            userdetail.email_id = email;
            userdetail.phone = '';
            userdetail.countrycode = '';

          } else {
            ret_id = users[0].id;

            userdetail.first_name = users[0].first_name ? users[0].first_name: 'Traveller';
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
          message: 'OTP Matched',
          datas: [{ token, userdetail }]
        });

      } else {
        return res.status(400).json({ success: false, message: 'OTP is not matched', datas: [] });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Record not found', datas: [] });
    }
  }
};


// export const sendResetPassword = async (req, res) => { 
//   var otp = getRandomInt(100000, 999999);
//   const { salt, hash } = getPassword('smt'+otp);

//   if (!req.body) {
//       return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//   }

//   const { email, phone_number, countrycode } = req.body;
//   const pool = getPool();
//   let getusers;
//   if (!email) {
//       if (!phone_number) {
//         return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
//       }

//       if (!countrycode) {
//         return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
//       }

//       const query = 'SELECT id FROM smt_users WHERE phone = $1 AND country_code = $2';
//       getusers = await pool.query(query, [phone_number, countrycode]);
//   }else{
//       const query = 'SELECT id FROM smt_users WHERE email_id = $1';
//       getusers = await pool.query(query, [email]);
//   }

//   if (getusers.rows.length == 0) {
//      if (!email) {
//         // send sms to user 
//         const query = 'SELECT id FROM smt_login_otp WHERE phone = $1 AND countrycode = $2';
//         const result = await pool.query(query, [phone_number, countrycode]);
//         if (result.rows.length > 0) {
//           console.log('here');
//           const updateQuery = 'UPDATE smt_login_otp SET hash = $1, salt = $2 WHERE phone = $3 AND countrycode = $4';
//           await pool.query(updateQuery, [hash, salt, phone_number, countrycode]);
//         }else{
//           console.log('there');
//           const insertQuery = 'INSERT INTO smt_login_otp (phone, countrycode, hash, salt) VALUES ($1, $2, $3, $4)';
//           await pool.query(insertQuery, [phone_number, countrycode, hash, salt]);
//         }
      
//         return res.status(200).json({
//             success: true,
//             message: 'OTP sent',
//             datas: [{ "otp":otp, 'phone_number':phone_number, 'countrycode':countrycode }] 
//         });
//      }else{
//         // send email to user
//         //otp
//         const query = 'SELECT id FROM smt_login_otp WHERE email_id = $1';
//         const result = await pool.query(query, [email]);
//         if (result.rows.length > 0) {
//           const updateQuery = 'UPDATE smt_login_otp SET hash = $1, salt = $2 WHERE email_id = $3';
//           await pool.query(updateQuery, [hash, salt, email]);
//         }else{
//           const insertQuery = 'INSERT INTO smt_login_otp (email_id, hash, salt) VALUES ($1, $2, $3)';
//           await pool.query(insertQuery, [email, hash, salt]);
//         }

//         return res.status(200).json({
//             success: true,
//             message: 'OTP sent',
//             datas: [{ "otp":otp, 'email':email }] 
//         });
//      }
//   }else{
//      return res.status(400).json({ 'success': false, 'message': 'No User Found', "datas": [] });
//   }
// }


export const sendResetPassword = async (req, res) => { 
  var otp = getRandomInt(100000, 999999);
  const { salt, hash } = getPassword('smt' + otp);

  if (!req.body) {
    return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
  }

  const { email, phone_number, countrycode } = req.body;
  const db = req.db;  // <-- MySQL connection

  let getusers;

  try {

    // ---------------------------------------------
    // CHECK USER EXISTS
    // ---------------------------------------------
    if (!email) {
      if (!phone_number) {
        return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
      }
      if (!countrycode) {
        return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
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
    if (getusers.length === 0) {

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
            db.query(updateQuery, [hash, salt, phone_number, countrycode], (err) => {
              if (err) reject(err);
              resolve();
            });
          });
        } else {
          const insertQuery = `INSERT INTO smt_login_otp (phone, countrycode, hash, salt) VALUES (?, ?, ?, ?)`;
          await new Promise((resolve, reject) => {
            db.query(insertQuery, [phone_number, countrycode, hash, salt], (err) => {
              if (err) reject(err);
              resolve();
            });
          });
        }

        return res.status(200).json({
          success: true,
          message: 'OTP sent',
          datas: [{ otp, phone_number, countrycode }]
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
          message: 'OTP sent',
          datas: [{ otp, email }]
        });
      }
    }

    // ---------------------------------------------
    // USER FOUND → ERROR
    // ---------------------------------------------
    return res.status(400).json({
      success: false,
      message: 'No User Found',
      datas: []
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      datas: []
    });
  }
};


// export const verifyResetPassword = async (req, res) => {
//   if (!req.body) {
//     return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
//   }
//   const pool = getPool();
//   const { email, phone_number, countrycode, otp } = req.body; 

//   if (!email) {
//     if (!phone_number) {
//       return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
//     }

//     if (!countrycode) {
//       return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
//     }
//     const query = 'SELECT hash, salt FROM smt_login_otp WHERE phone = $1 AND countrycode = $2';
//     result = await pool.query(query, [phone_number, countrycode]);
//   }else{
//     const query = 'SELECT hash, salt FROM smt_login_otp WHERE email_id = $1';
//     result = await pool.query(query, [email]);
//   }

//   if (result.rows.length > 0) {
//       const isValid = validPassword('smt'+otp, result.rows[0].salt, result.rows[0].hash);
//       if(isValid){
//          let getusers;
//          if (!email) {
//               const query = 'SELECT id, group_id, email_id, first_name, last_name FROM smt_users WHERE phone = $1 AND country_code = $2';
//               getusers = await pool.query(query, [phone_number, countrycode]);
//          }else{
//               const query = 'SELECT id, group_id, phone, country_code, first_name, last_name FROM smt_users WHERE email_id = $1';
//               getusers = await pool.query(query, [email]);
//          }

//          if (getusers.rows.length == 0) {
//               var userdet = {
//                  'first_name' : getusers.rows[0].first_name ? getusers.rows[0].first_name : "",
//                  'last_name' : getusers.rows[0].last_name ? getusers.rows[0].last_name : "",
//                  'email_id' : getusers.rows[0].email_id ? getusers.rows[0].email_id : "",
//                  'phone' : getusers.rows[0].phone ? getusers.rows[0].phone : "",
//                  'countrycode' : getusers.rows[0].country_code ? getusers.rows[0].country_code : ""
//               };
//              let token = generateJwt(getusers.rows[0].id, getusers.rows[0].group_id);
//              return res.status(200).json({ 'success': true, 'message': 'OTP Matched', "datas": [{'token':token, userdet}] });
//          }else{
//              return res.status(400).json({ 'success': false, 'message': 'Something went wrong', "datas": [] });
//          }
//       }else{
//          return res.status(400).json({ 'success': false, 'message': 'OTP is not matched', "datas": [] });
//       }
//   }else{
//       return res.status(400).json({ 'success': false, 'message': 'Record not found', "datas": [] });
//   }
// }

export const verifyResetPassword = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ success: false, message: 'All input are missing', datas: [] });
  }

  const db = req.db;
  const { email, phone_number, countrycode, otp } = req.body;

  let result;

  // ---------------------------
  // Validate input
  // ---------------------------
  if (!email) {
    if (!phone_number) {
      return res.status(400).json({ success: false, message: 'phone_number missing', datas: [] });
    }

    if (!countrycode) {
      return res.status(400).json({ success: false, message: 'countrycode missing', datas: [] });
    }

    result = await new Promise((resolve, reject) => {
      db.query(
        `SELECT hash, salt FROM smt_login_otp WHERE phone = ? AND countrycode = ?`,
        [phone_number, countrycode],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });

  } else {
    result = await new Promise((resolve, reject) => {
      db.query(
        `SELECT hash, salt FROM smt_login_otp WHERE email_id = ?`,
        [email],
        (err, rows) => (err ? reject(err) : resolve(rows))
      );
    });
  }

  // ---------------------------
  // OTP Check
  // ---------------------------
  if (result.length === 0) {
    return res.status(400).json({ success: false, message: "Record not found", datas: [] });
  }

  const isValid = validPassword("smt" + otp, result[0].salt, result[0].hash);

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: "OTP is not matched",
      datas: []
    });
  }

  // ---------------------------
  // Fetch User
  // ---------------------------
  // let getusers;

  // if (!email) {
  //   getusers = await new Promise((resolve, reject) => {
  //     db.query(
  //       `SELECT id, group_id, email_id, first_name, last_name, phone, country_code 
  //        FROM smt_users WHERE phone = ? AND country_code = ?`,
  //       [phone_number, countrycode],
  //       (err, rows) => (err ? reject(err) : resolve(rows))
  //     );
  //   });
  // } else {
  //   getusers = await new Promise((resolve, reject) => {
  //     db.query(
  //       `SELECT id, group_id, phone, country_code, first_name, last_name, email_id 
  //        FROM smt_users WHERE email_id = ?`,
  //       [email],
  //       (err, rows) => (err ? reject(err) : resolve(rows))
  //     );
  //   });
  // }

  // // -------------------------------------
  // // FIXED: Correct condition (your code had reversed logic)
  // // -------------------------------------
  // if (getusers.length === 0) {
  //   return res.status(400).json({
  //     success: false,
  //     message: "No User Found",
  //     datas: []
  //   });
  // }

  // // ---------------------------
  // // Prepare user data
  // // ---------------------------
  // const user = getusers[0];

  // const userdet = {
  //   first_name: user.first_name || "",
  //   last_name: user.last_name || "",
  //   email_id: user.email_id || "",
  //   phone: user.phone || "",
  //   countrycode: user.country_code || ""
  // };

  // const token = generateJwt(user.id, user.group_id);

  return res.status(200).json({
    success: true,
    message: "OTP Matched",
    datas: []
  });
};


// export const setpasswordfromlogin = async (req, res) => {
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

//   const updateQuery = 'UPDATE smt_users SET hash = $1, salt = $2 WHERE id = $3';
//   await pool.query(updateQuery, [hash, salt, userid]);

//   return res.status(200).json({
//             success: true,
//             message: 'Password updated',
//             datas: [] 
//         });

// }

export const setpasswordfromlogin = async (req, res) => {
  if (!req.body) {
    return res.status(400).json({
      success: false,
      message: 'All input are missing',
      datas: []
    });
  }

  const db = req.db;  // MySQL connection
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
      message: 'Password updated',
      datas: []
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
















