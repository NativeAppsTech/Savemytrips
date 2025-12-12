//var jwt = require('jsonwebtoken');
import jwt from 'jsonwebtoken'; 
//var config = require('../config');

function verifyToken(req, res, next) {
  var token = req.headers['x-access-token'];
  if (!token)  
    return res.status(403).send({ 'success': false, 'message': 'Forbidden Making a request that isn’t allowed.' });
  jwt.verify(token, 'nativeappstech', function(err, decoded) {
    if (err)
      return res.status(401).send({ 'success' : false, message: 'Failed to authenticate token.' });
    // save to request for use in other routes
    req.userId = decoded.id;
    req.groupId = decoded.group_id;
    req.email_id = decoded.email_id;
    next();
  });
}

export default verifyToken;
