import { Router, Request, Response } from 'express';
import * as nodemailer from 'nodemailer';

const router = Router();

interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

// POST /api/contact - Handle contact form submissions
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message }: ContactRequest = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'All fields are required',
          code: 'MISSING_FIELDS'
        }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid email format',
          code: 'INVALID_EMAIL'
        }
      });
    }

    // Validate message length
    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Message too long (max 5000 characters)',
          code: 'MESSAGE_TOO_LONG'
        }
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'damrec.prod@gmail.com',
      subject: `Skribble Contact: ${subject}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px;">
              <h2 style="color: #1e293b; margin: 0; font-size: 24px;">New Contact Form Message</h2>
              <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">From Skribble Website</p>
            </div>
            
            <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <div style="margin-bottom: 15px;">
                <strong style="color: #334155; display: inline-block; width: 80px;">Name:</strong>
                <span style="color: #1e293b;">${name}</span>
              </div>
              <div style="margin-bottom: 15px;">
                <strong style="color: #334155; display: inline-block; width: 80px;">Email:</strong>
                <span style="color: #3b82f6;">${email}</span>
              </div>
              <div>
                <strong style="color: #334155; display: inline-block; width: 80px;">Subject:</strong>
                <span style="color: #1e293b;">${subject}</span>
              </div>
            </div>
            
            <div style="background: white; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 20px;">
              <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Message:</h3>
              <p style="color: #334155; line-height: 1.6; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This message was sent from the Skribble website contact form on ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      `,
      replyTo: email,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`📧 Contact form submission from ${email}: ${subject}`);

    res.status(200).json({
      success: true,
      data: {
        message: 'Message sent successfully'
      }
    });

  } catch (error) {
    console.error('❌ Contact form error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to send message',
        code: 'EMAIL_SEND_ERROR'
      }
    });
  }
});

export default router;