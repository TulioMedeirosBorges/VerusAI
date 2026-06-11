// Envio de e-mails (Gmail via nodemailer). O server.js carrega o dotenv antes
// de requerer este módulo, então as credenciais já estão em process.env.
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

function emailEmpresaDestino() {
  return (
    process.env.EMPRESA_EMAIL ||
    process.env.COMPANY_EMAIL ||
    process.env.CONTATO_EMAIL ||
    process.env.EMAIL_USER ||
    ""
  );
}

module.exports = { transporter, emailEmpresaDestino };
