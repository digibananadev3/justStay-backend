import axios from "axios";

const sendSMS = async (mobile, message) => {
  const url = process.env.SMS_API_URL;

//   https://www.smsgatewayhub.com/api/mt/SendSMS?APIKey=yourapicode&senderid=TESTIN&channel=2&DCS=0&flashsms=0&number=91989xxxxxxx&text=test-message&route=clickhere&EntityId=Registered-Entity-Id&dlttemplateid=Registered-DLT-Template-Id


  const params = {
    APIKey: process.env.SMS_API_KEY,
    senderid: process.env.SMS_SENDER_ID,
    channel: "2",
    DCS: "0",
    flashsms: "0",
    number: mobile,
    text: message,
    route: process.env.SMS_ROUTE,
    EntityId: process.env.SMS_ENTITY_ID,
    dlttemplateid: process.env.SMS_TEMPLATE_ID
  };

   console.log(`${url}?APIKey=${process.env.SMS_API_KEY}&senderid=${process.env.SMS_SENDER_ID}&channel=2&DCS=0&flashsms=0&number=${mobile}&text=${encodeURIComponent(message)}&route=${process.env.SMS_ROUTE}&EntityId=${process.env.SMS_ENTITY_ID}&dlttemplateid=${process.env.SMS_TEMPLATE_ID}`);

  const response = await axios.get(url, { params });
  return response.data;
};

export default sendSMS;
