import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.mailtrap.io")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM", "noreply@bugtriage.app")
        self.from_name = os.getenv("SMTP_FROM_NAME", "Bug Triage")

    async def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email

            html_part = MIMEText(html_content, "html")
            msg.attach(html_part)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                if self.smtp_user and self.smtp_password:
                    server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())

            logger.info(f"Email sent successfully to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    def get_password_reset_html(self, otp: str, user_name: Optional[str] = None) -> str:
        first_name = user_name.split()[0] if user_name else "User"
        
        return f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - Bug Triage</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" 
                       style="max-width: 500px; background-color: #ffffff; border-radius: 8px; 
                              box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                                    padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                🔧 Bug Triage
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 20px; font-weight: 600;">
                                Password Reset Request
                            </h2>
                            
                            <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                Hi {first_name},
                            </p>
                            
                            <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                We received a request to reset your password. Use the verification code below to proceed:
                            </p>
                            
                            <!-- OTP Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td style="background-color: #f3f4f6; border-radius: 8px; 
                                                padding: 24px; text-align: center;">
                                        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; 
                                                   text-transform: uppercase; letter-spacing: 1px;">
                                            Verification Code
                                        </p>
                                        <p style="margin: 0; font-size: 32px; font-weight: 700; 
                                                   color: #3b82f6; letter-spacing: 8px; font-family: monospace;">
                                            {otp}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Info -->
                            <p style="margin: 30px 0 20px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                This code expires in <strong style="color: #1f2937;">10 minutes</strong>.
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                If you didn't request this password reset, you can safely ignore this email. 
                                Your account security remains intact.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 20px 30px; 
                                    border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
                            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-align: center;">
                                This is an automated message from Bug Triage.
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                                © 2026 Bug Triage. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service