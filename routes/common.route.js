import express from 'express'; 
import verifyToken from './VerifyToken.js'; 


//import controller file
import * as userCtrl from '../controllers/users.js';
// get an instance of express router
const router = express.Router();


router.route('/users/checkemail').post(userCtrl.checkEmailPresent);
router.route('/users/sendotp').post(userCtrl.sendOTP);
router.route('/users/verifylogin').post(userCtrl.verifyLogin);
router.route('/users/resetpassword').post(userCtrl.sendResetPassword);
router.route('/users/verifyresetpassword').post(userCtrl.verifyResetPassword);
router.route('/users/setpassword').post(verifyToken, userCtrl.setpasswordfromlogin);
export default router;
