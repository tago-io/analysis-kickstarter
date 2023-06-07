import { PaperFormat, PDFOptions } from "puppeteer";
import { Services } from "@tago-io/sdk";
import { UserInfo } from "@tago-io/sdk/out/modules/Account/run.types";
import { TagoContext } from "@tago-io/sdk/out/modules/Analysis/analysis.types";
import { headerTemplate, footerTemplate } from "../lib/pdfTemplate";

// ? ==================================== (c) TagoIO ====================================
// ? What is in this file?
// * This file creates a PDF and send it via email, the PDF file will contain a headerTemplate and footerTemplate and should receive a HTML body throught the function call.
// ? ====================================================================================

//code below is a base64 code for MyCompany logo


const options: PDFOptions = {
  path: "example.pdf", //changes the path where the file will be stored
  displayHeaderFooter: true,
  headerTemplate,
  footerTemplate,
  format: "A4" as PaperFormat,
  margin: {
    bottom: 70,
    left: 25,
    right: 35,
    top: 110,
  },
  printBackground: true,
};

export default async function createPDF(context: TagoContext, htmlBody: string, users_info_list: Array<UserInfo>, org_name: string) {
  // Start the email service
  const email = new Services({ token: context.token }).email;

  // Start the PDF service
  const pdf = new Services({ token: context.token }).PDF;

  options.headerTemplate = headerTemplate.replace("$ORG_NAME$", org_name);
  const base64 = Buffer.from(htmlBody).toString("base64");

  const report = await pdf.generate({ base64, options }).catch((msg) => console.debug(msg));

  // Send the email.
  users_info_list.forEach(async (user_info) => {
    if (user_info?.email) {
      await email
        .send({
          to: user_info?.email,
          subject: "System Report",
          message: "Find attached your PDF below.",
          attachment: {
            archive: (report as any).result,
            type: "base64",
            filename: "sensor_report.pdf",
          } as any,
        })
        .then((msg) => console.debug(msg))
        .catch((msg) => console.debug(msg));
    } else {
      console.debug("Error - couldnt find user");
    }
  });

  return console.debug("PDF Generated!");
}
