import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

let firebaseApp: admin.app.App;

export function initializeFirebase(config: ConfigService): admin.app.App {
    if (firebaseApp) return firebaseApp;

    const projectId = config.get<string>('firebase.projectId');
    const clientEmail = config.get<string>('firebase.clientEmail');
    const privateKey = config.get<string>('firebase.privateKey');

    // If individual credentials are provided, use them; otherwise fall back to
    // GOOGLE_APPLICATION_CREDENTIALS (application default credentials).
    const credential =
        projectId && clientEmail && privateKey
            ? admin.credential.cert({ projectId, clientEmail, privateKey })
            : admin.credential.applicationDefault();

    firebaseApp = admin.initializeApp({ credential });

    return firebaseApp;
}

export function getFirebaseAdmin(): admin.app.App {
    if (!firebaseApp) {
        throw new Error(
            'Firebase Admin has not been initialised. ' +
            'Make sure initializeFirebase() is called during app bootstrap.',
        );
    }
    return firebaseApp;
}
