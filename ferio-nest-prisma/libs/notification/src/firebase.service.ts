import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (this.firebaseInitialized) return;

    try {
      if (!process.env.FIREBASE_PROJECT_ID) {
        this.logger.warn('⚠️ Firebase credentials not found in env. Push notifications will be disabled.');
        return;
      }

      if (admin.apps.length === 0) {
        const serviceAccount = {
          type: process.env.FIREBASE_TYPE,
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: process.env.FIREBASE_AUTH_URI,
          token_uri: process.env.FIREBASE_TOKEN_URI,
          auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
          client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
          universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as any),
        });
        this.logger.log('✅ Firebase Admin SDK initialized');
      }
      this.firebaseInitialized = true;
    } catch (error: any) {
      this.logger.warn(`⚠️ Failed to initialize Firebase Admin SDK: ${error.message}`);
    }
  }

  async sendPushNotification(fcmToken: string, title: string, body: string, data?: any) {
    if (!this.firebaseInitialized) {
      this.logger.warn('⚠️ Push notification skipped (Firebase Admin SDK not initialized)');
      return;
    }
    try {
      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: { title, body },
        data: data || {},
      };
      await admin.messaging().send(message);
      this.logger.log(`✅ Push notification sent to ${fcmToken}`);
    } catch (error) {
      this.logger.error('❌ Error sending push notification:', error);
    }
  }
}
