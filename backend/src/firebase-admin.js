const admin = require("firebase-admin");

const serviceAccount = {
  type: "service_account",
  project_id: "mdss-47750",
  private_key_id: "929905540a995b12fa78c3a45e951c73453608a0",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCoVqkz8/Qqhu0k\nSUPOV5euMxPTGVPHvUsT0tSLSF63QrRuvuh4P6q5YmdrtER/gpBjvdpYNDBqJq4O\nNhbQ2wrOLps+9ZA8emixvDCJ69JSdx1g8dXzh3I74YoMwIQs4XY3aRULejg4Wxd9\nJq9ZrU3rFq0MdPGnnxqHr9jiHdStNraEFeQH2FKD1g97/lg1NP9Xyt85xj3+2p6o\ngOgnJuUWHrNVNDKTkzqjnl7qf8LwAFmDs+UQ8+yoKenYU5LvhcQMJLqei1/7DFKw\np0P5xKWfrYzjDo+I68GDFe1184U7LwcqWXsOlcr1DsNC3vWIU2Jv/PoDHf1yh+fl\nayoj8N91AgMBAAECggEAB+dIXk88rk4+MbRw43xCGB1jBfJoafZC74G4Bz+cFs9a\n4W6m0ZYLM6pvlSpylRMcmq+ODKFSpbL+bc/TTWfG4ybyP1YznJX2BPKt6A56aZ3D\ngYPCEvTP2Qjhg8WlB+agcIgcpqp3YrSjtdjouwO8fC1lbYeu8fPOTwLjYoLTQa3p\nJiNn+iH5YjfkUhl4EiGxS3cyBJvJ2Dei4lq0Z5RjUA2uuMlxJSo28sFdx+Z9J8Jm\nmXtWAzPGurd8nJNKTZBy+9N/hiB2xVq0VrugbiqSpNWKAsTeeszNFmX2Eld8sGxj\n2H3Q5Pp4rLzbc3/T03gf97OTGN+Wmc8NqP3z3jza9wKBgQDXTOZYB86Z8UVxt5aj\nJukqvJLon+hk/EgdinvtXVLcLltGV7QTKiqEqHaEHoLg+Pu+RDIe4EjKzWTYgcgD\ncKBazb3fpxdJ28M60ZzkNbG/1uZYB6HeSmj1OpkbiWzFiDybEMybwFgZ9jjzfjSJ\nNtoJo2lGAZtOAJZQttBDjlyxewKBgQDIKR7VKosGgCCOqaC1MgSHs/nS7L/Taq3x\nRoaKjBV0/Hr92isvtb812hJUq8kjIriDiWlwVsg64TMkFvmf//DJdZ/lefBbnjs9\nBAjnjitpNvqi+UHHGjGyeFnWUBtHw+dgPpfKRySp0XrHw+mH0Zdh61a4iju6RQMv\naPziYXkHzwKBgF00+XOazaJvhTTZ2ej/62mJAcCbmaw+W6oOTeBQypJvrywgw+CY\nHJgZplVEMDzdDX8tXtVnG5xQlxvz83cpxwIIl+6/E6Hx9e782AMkC7OVgVsS0sy9\nQfsIR0hYkjJh7HrlJu82se1rXvRq6quMh5AsomKgR2/ZaTnAKyFT/GUJAoGAJ603\nBmxTeKtnSMBJMgHDMh8z82Kot8Da0Av52XbhPfpaav2XN/Lf/03F+nC/Ay77wl83\nvmQFdt5zI8FGJDg4w8aENpnQUmjwNy0YksX0xvt1/V5Jcq03krgWnsvsTHKB5+sg\nbaFinCMBIp4sKZcbWfarjxMfudG6SuiV0E4gDrMCgYEAiFqH8T5nvYBz9yJ47Dk/\nbOe1kNuQsRgPRlfSl1gXzy4HxOBWvpOehUaO7FW+bkWdR/8cLCLRpPxqLacckoal\nPR6X5v1TSRqCHMY3jv5qTmiw37uWNb0dCn/ObeVl6I8gcm6fuVqzjnCnxfavtFyY\nDOdrCwKPwMDg47D21iBBtVY=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@mdss-47750.iam.gserviceaccount.com",
  "client_id": "110198409460767930931",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40mdss-47750.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mdss-47750.firebaseio.com"
});

const db = admin.database();
const firestore = admin.firestore;

module.exports = { admin, db, firestore };