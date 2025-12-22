import express from 'express'; 
import verifyToken from './VerifyToken.js'; 


//import controller file
import * as userCtrl from '../controllers/users.js';
import * as commonCtrl from '../controllers/common.js';
import * as travellerCtrl from '../controllers/traveller.js';
// get an instance of express router
const router = express.Router();


router.route('/users/checkemail').post(userCtrl.checkEmailPresent);
router.route('/users/checkphone').post(userCtrl.checkPhonePresent);
router.route('/users/sendotp').post(userCtrl.sendOTP);
router.route('/users/verifylogin').post(userCtrl.verifyLogin);
router.route('/users/resetpassword').post(userCtrl.sendResetPassword);
router.route('/users/verifyresetpassword').post(userCtrl.verifyResetPassword);
router.route('/users/setpassword').post(verifyToken, userCtrl.setpasswordfromlogin);

router.route('/users/countryswitch').post(userCtrl.countryswith);
router.route('/common/getcountries').get(commonCtrl.listCountries);
router.route('/common/getstates').get(commonCtrl.listZonesByCountry);
router.route('/common/getsplids').get(verifyToken, commonCtrl.listSpecialCountryUserIds);
router.route('/users/getcustomerprofile').get(verifyToken, userCtrl.getUserProfile);
router.route('/users/updatecustomerprofile').post(verifyToken, userCtrl.updateUserProfile);

router.route('/traveller/add').post(verifyToken, travellerCtrl.addCoTraveller);
router.route('/traveller/list').get(verifyToken, travellerCtrl.listCoTravellers);
router.route('/traveller/update/:id').post(verifyToken, travellerCtrl.updateCoTraveller);
router.route('/traveller/delete/:id').post(verifyToken, travellerCtrl.deleteCoTraveller);
export default router;
