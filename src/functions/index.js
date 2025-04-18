const functions = require('firebase-functions');
const axios = require('axios');
const cors = require('cors')({ origin: true });

exports.getIceServers = functions.https.onRequest((request, response) => {
  return cors(request, response, async () => {
    try {
      // Get Twilio credentials from environment variables
      const API_KEY_SID = functions.config().twilio.sid;
      const API_KEY_SECRET = functions.config().twilio.secret;
      
      // Call Twilio API from the server
      const twilioResponse = await axios({
        method: 'post',
        url: 'https://networktraversal.twilio.com/v1/Tokens',
        auth: {
          username: API_KEY_SID,
          password: API_KEY_SECRET
        }
      });
      
      // Return the ICE servers to the client
      response.json({ iceServers: twilioResponse.data.ice_servers });
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      response.status(500).json({ error: 'Failed to fetch ICE servers' });
    }
  });
});
