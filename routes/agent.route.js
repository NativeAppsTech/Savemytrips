import express from 'express'; 
import agentVerifyToken from './AgentVerifyToken.js'; 


//import controller file
import * as agentCtrl from '../controllers/agent.js';
// get an instance of express router
const router = express.Router();

//router.route('/users/setpassword').post(adminCtrl.setpassword);
router.route('/users/verifylogin').post(agentCtrl.verifyLogin);
export default router;
