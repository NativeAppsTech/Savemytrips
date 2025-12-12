import express from 'express'; 
import adminVerifyToken from './AdminVerifyToken.js'; 


//import controller file
import * as adminCtrl from '../controllers/admin.js';
// get an instance of express router
const router = express.Router();

router.route('/users/setpassword').post(adminCtrl.setpassword);
router.route('/users/verifylogin').post(adminCtrl.verifyLogin);
export default router;
