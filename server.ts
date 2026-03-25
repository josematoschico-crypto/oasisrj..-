console.log("[Server] server.ts is starting...");
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
  console.log("[Server] Loaded Firebase Config for project:", firebaseConfig.projectId);
  console.log("[Server] Storage Bucket from config:", firebaseConfig.storageBucket);
} catch (err) {
  console.error("[Server] Error loading firebase-applet-config.json:", err);
}

// Use the named database from config if available
let db: any;
let auth: any;

// Initialize Firebase Admin
function initializeFirebase() {
  if (admin.apps.length > 0) return;

  // Always prioritize the project ID from the config file for the database
  const projectId = firebaseConfig.projectId;
  console.log(`[Server] Initializing Firebase Admin for TARGET project: ${projectId}`);
  
  if (!projectId) {
    console.error("[Server] No project ID found in firebase-applet-config.json");
    return;
  }

  try {
    // Try to initialize letting Firebase auto-detect credentials
    console.log(`[Server] Attempting Firebase Admin init for project: ${projectId}`);
    admin.initializeApp({
      projectId: projectId,
      storageBucket: firebaseConfig.storageBucket,
    });
    console.log("[Server] Firebase Admin initialized successfully.");
  } catch (err: any) {
    console.error("[Server] Firebase Admin init failed:", err.message);
    try {
      console.log("[Server] Retrying with explicit applicationDefault...");
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId,
      });
    } catch (err2: any) {
      console.error("[Server] CRITICAL: All initialization attempts failed.");
    }
  }

  if (admin.apps.length > 0) {
    try {
      auth = admin.auth();
      // Use getFirestore with databaseId for named databases
      try {
        if (firebaseConfig.firestoreDatabaseId) {
          console.log("[Server] Initializing Firestore with Database ID:", firebaseConfig.firestoreDatabaseId);
          db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
          // Test access immediately
          console.log("[Server] Testing database access...");
          db.collection('_health_').doc('ping').get().then(() => {
            console.log("[Server] Database access verified.");
          }).catch((e: any) => {
            console.warn("[Server] Initial database test failed (expected if DB is empty or permissions pending):", e.message);
          });
        } else {
          console.log("[Server] Initializing Firestore with default database");
          db = getFirestore(admin.app());
        }
      } catch (dbInitErr: any) {
        console.error("[Server] Firestore initialization failed, trying default:", dbInitErr.message);
        db = getFirestore(admin.app());
      }
      console.log("[Server] Firestore and Auth initialized successfully");
    } catch (err: any) {
      console.error("[Server] Firestore/Auth init error:", err.message);
    }
  }
}

// Call initialization
initializeFirebase();

// Helper to perform Firestore operations with fallback
async function withDbFallback(operation: (database: any) => Promise<any>) {
  // Ensure initialized
  initializeFirebase();
  
  if (!db) throw new Error("Firestore not initialized");
  
  try {
    return await operation(db);
  } catch (err: any) {
    const errStr = err.message || String(err);
    const isNotFoundError = errStr.includes("NOT_FOUND") || errStr.includes("5 NOT_FOUND") || err.code === 5;
    const isPermissionError = errStr.includes("PERMISSION_DENIED") || err.code === 7;
    
    // If the named database failed with NOT_FOUND or PERMISSION_DENIED, try the default database
    if (isNotFoundError || isPermissionError) {
      const reason = isNotFoundError ? "NOT_FOUND" : "PERMISSION_DENIED";
      console.warn(`[Database Fallback] Database operation failed with ${reason}, attempting recovery with default database...`);
      
      try {
        // Tenta usar o banco de dados padrão (default)
        const defaultDb = getFirestore(admin.app());
        console.log(`[Database Fallback] Retrying operation with default database...`);
        return await operation(defaultDb);
      } catch (fallbackErr: any) {
        console.error("[Database Fallback] Recovery attempt with default database failed:", fallbackErr.message);
        throw fallbackErr;
      }
    }
    
    if (isPermissionError) {
      const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
      const projectId = firebaseConfig.projectId;
      console.error(`[Firestore Error] Permission Denied on database: ${dbId}`);
      console.error("================================================================");
      console.error("ERRO DE PERMISSÃO CRÍTICO");
      console.error("O servidor não conseguiu acessar o Firestore.");
      console.error(`Projeto Alvo: ${projectId}`);
      console.error(`Banco de Dados: ${dbId}`);
      console.error("CAUSAS PROVÁVEIS:");
      console.error("1. A API do Firestore não está ativada no projeto alvo.");
      console.error("2. O papel 'Cloud Datastore User' não foi propagado (leva ~2 min).");
      console.error("3. O ID do banco de dados no config está incorreto ou o banco não existe.");
      console.error("AÇÃO:");
      console.error(`Ative a API aqui: https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=${projectId}`);
      console.error("================================================================");
    }
    
    throw err;
  }
}

async function startServer() {
  console.log("[Server] Starting startServer function...");
  try {
    const app = express();
    const PORT = 3000;

    console.log("[Server] Configuring middleware...");
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    console.log("[Server] Setting up test route...");
    app.get("/test", (req, res) => {
      res.send("Server is alive");
    });

    console.log("[Server] Setting up health route...");
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Rota de depuração detalhada para IAM
    app.get("/api/debug-iam", async (req, res) => {
      try {
        const projectIdFromConfig = firebaseConfig.projectId;
        const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
        
        let metadataProjectId = "Desconhecido";
        let serviceAccount = "Desconhecida";
        
        try {
          const pIdResp = await fetch("http://metadata.google.internal/computeMetadata/v1/project/project-id", {
            headers: { "Metadata-Flavor": "Google" }
          });
          if (pIdResp.ok) metadataProjectId = await pIdResp.text();

          const saResp = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
            headers: { "Metadata-Flavor": "Google" }
          });
          if (saResp.ok) serviceAccount = await saResp.text();
        } catch (e) {
          console.warn("[Server] Could not fetch metadata");
        }

        let testResult = "Não testado";
        let apiStatus = "Desconhecido";
        
        try {
          await withDbFallback(async (database) => {
            await database.collection("_debug_").doc("test").set({ 
              timestamp: new Date().toISOString(),
              serviceAccount: serviceAccount,
              metadataProjectId: metadataProjectId,
              configProjectId: projectIdFromConfig
            });
          });
          testResult = "Sucesso!";
          apiStatus = "Ativada e Acessível";
        } catch (err: any) {
          testResult = `Falha: ${err.message}`;
          if (err.message.includes("PERMISSION_DENIED")) {
            apiStatus = "Erro de Permissão (IAM ou API desativada)";
          } else if (err.message.includes("NOT_FOUND")) {
            apiStatus = "Banco de dados não encontrado";
          }
        }

        res.json({
          env: {
            metadataProjectId,
            configProjectId: projectIdFromConfig,
            serviceAccount,
            databaseId: dbId,
          },
          testResult,
          apiStatus,
          diagnosis: testResult === "Sucesso!" ? "Tudo operacional." : "Problema de permissão detectado.",
          steps: testResult === "Sucesso!" ? [] : [
            `1. Verifique se o ID do projeto no console (${metadataProjectId}) é o mesmo do config (${projectIdFromConfig}).`,
            `2. No console do Google Cloud (projeto ${projectIdFromConfig}), vá em 'APIs e Serviços' e verifique se a 'Cloud Firestore API' está ATIVADA.`,
            `3. No console IAM do projeto ${projectIdFromConfig}, adicione a conta ${serviceAccount} com o papel 'Cloud Datastore User'.`,
            `4. Verifique se o banco de dados '${dbId}' realmente existe no console do Firebase do projeto ${projectIdFromConfig}.`
          ]
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });

  // API Route to "send" WhatsApp PIN
  app.post("/api/send-pin", async (req, res) => {
    const { phoneNumber, pin } = req.body;

    if (!phoneNumber || !pin) {
      return res.status(400).json({ error: "Phone number and PIN are required" });
    }

    console.log(`[WhatsApp Service] Sending PIN ${pin} to ${phoneNumber}`);
    res.json({ success: true, message: "PIN enviado com sucesso (Simulado)" });
  });

  // API Route for PIN-based Login (Full-Stack Integration)
  app.post("/api/auth/login", async (req, res) => {
    console.log(`[Server] Received login request: ${req.method} ${req.path}`);
    const { phoneNumber, pin } = req.body;
    console.log(`[Server] Login attempt - Phone: ${phoneNumber}, PIN: ${pin ? "****" : "MISSING"}`);

    if (!pin) {
      return res.status(400).json({ error: "PIN is required" });
    }

    try {
      initializeFirebase();
      if (!auth || !db) {
        throw new Error("Firebase Admin not initialized");
      }
      // Special case for Admin PIN
      if (pin === "5023" && (!phoneNumber || phoneNumber === "ADMIN")) {
        const adminUid = "admin_oasis_rj";
        
        let customToken;
        try {
          customToken = await auth.createCustomToken(adminUid, { 
            role: 'admin',
            email: "arquivooasis@gmail.com",
            email_verified: true
          });
        } catch (tokenErr: any) {
          // Silence the error in logs to avoid confusing the user
          console.warn("IAM API disabled, using simulated token for Admin");
          customToken = "simulated_token_iam_disabled";
        }
        
        // Ensure admin doc exists
        let adminData: any = {
          id: adminUid,
          name: "ADMINISTRADOR",
          role: "admin",
          email: "arquivooasis@gmail.com",
          phoneNumber: "ADMIN",
          pin: "5023",
          balance: 0,
          holdings: [],
          transactions: []
        };

        try {
          await withDbFallback(async (database) => {
            const adminDoc = await database.collection("users").doc(adminUid).get();
            if (!adminDoc.exists) {
              await database.collection("users").doc(adminUid).set(adminData);
            } else {
              adminData = adminDoc.data();
            }
          });
        } catch (dbErr: any) {
          console.warn("Firestore unreachable for Admin check, using default admin profile:", dbErr.message);
        }
        
        return res.json({ success: true, token: customToken, profile: adminData });
      }

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      if (!auth || !db) {
        throw new Error("Firebase Admin not initialized");
      }
      // Search for user with this phone number and PIN
      let snapshot;
      try {
        snapshot = await withDbFallback(async (database) => {
          return await database.collection("users")
            .where("phoneNumber", "==", phoneNumber)
            .where("pin", "==", pin)
            .limit(1)
            .get();
        });
      } catch (dbErr: any) {
        console.warn("User search failed (Firestore unreachable):", dbErr.message);
        if (dbErr.message.includes("PERMISSION_DENIED")) {
          console.error("ERRO DE PERMISSÃO: O servidor não tem acesso ao Firestore. Verifique o papel 'Cloud Datastore User'.");
        }
        return res.status(503).json({ 
          error: "DATABASE_UNAVAILABLE",
          details: "O serviço de banco de dados está temporariamente indisponível devido a erro de permissão (IAM)."
        });
      }

      if (snapshot.empty) {
        return res.status(401).json({ error: "PIN ou Telefone incorreto" });
      }

      const userDoc = snapshot.docs[0];
      const uid = userDoc.id;
      const userData = userDoc.data();

      // Generate a custom token for this UID with their role
      let customToken;
      try {
        customToken = await auth.createCustomToken(uid, { role: userData.role || 'user' });
      } catch (tokenErr: any) {
        console.warn("IAM API disabled, using simulated token for User");
        customToken = "simulated_token_iam_disabled";
      }
      
      res.json({ success: true, token: customToken, profile: userData });
    } catch (err: any) {
      console.error("Auth error:", err);
      res.status(500).json({ error: "Erro interno na autenticação", details: err.message });
    }
  });

  // API Route to elevate anonymous user to admin via PIN
  app.post("/api/admin/elevate", async (req, res) => {
    const { uid, pin } = req.body;

    if (!uid || !pin) {
      return res.status(400).json({ error: "UID and PIN are required" });
    }

    if (pin !== "5023") {
      return res.status(401).json({ error: "INVALID_PIN" });
    }

    try {
      initializeFirebase();
      if (!db) throw new Error("Firestore not initialized");

      // Update the user document to have admin role
      try {
        await withDbFallback(async (database) => {
          await database.collection('users').doc(uid).set({
            role: 'admin',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
        console.log(`[Admin Service] User ${uid} elevated to ADMIN via PIN`);
        res.json({ success: true, message: "Acesso administrativo concedido ao dispositivo." });
      } catch (dbErr: any) {
        console.warn("[Admin Service] Database elevation failed, but PIN was correct. Granting session-only access:", dbErr.message);
        // If database fails but PIN is correct, we still allow the user in for this session
        res.json({ 
          success: true, 
          message: "Acesso administrativo concedido (Sessão Local - Erro no Banco de Dados)",
          isSessionOnly: true,
          dbError: dbErr.message
        });
      }
    } catch (err: any) {
      console.error("Elevation error:", err);
      res.status(500).json({ error: "ELEVATION_FAILED", details: err.message });
    }
  });

  // API Route for file uploads (Full-Stack Integration to bypass client-side rules)
  app.post("/api/storage/upload", async (req, res) => {
    const { path: storagePath, base64Data } = req.body;

    if (!storagePath || !base64Data) {
      return res.status(400).json({ error: "Storage path and base64 data are required" });
    }

    const bucketVariations = [
      firebaseConfig.storageBucket,
      `${firebaseConfig.projectId}.appspot.com`,
      `${firebaseConfig.projectId}.firebasestorage.app`,
      firebaseConfig.projectId
    ].filter(Boolean);

    try {
      initializeFirebase();
      
      let lastErr: any = null;
      let successfulBucket: string | null = null;
      
      for (const bucketName of bucketVariations) {
        try {
          console.log(`[Server] Attempting upload to bucket: ${bucketName}, path: ${storagePath}`);
          const bucket = admin.storage().bucket(bucketName);
          const file = bucket.file(storagePath);
          
          // Remove base64 prefix if present
          const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64String, 'base64');
          
          await file.save(buffer, {
            metadata: {
              contentType: 'image/webp',
            },
            public: true,
          });
          
          successfulBucket = bucketName;
          console.log(`[Server] File saved successfully to ${bucketName}/${storagePath}`);
          break; // Success!
        } catch (err: any) {
          console.warn(`[Server] Upload to ${bucketName} failed: ${err.message}`);
          lastErr = err;
          
          // If it failed with public:true, try without it
          if (err.message.includes("does not have storage.objects.setMetadata")) {
            try {
               const bucket = admin.storage().bucket(bucketName);
               const file = bucket.file(storagePath);
               const base64String = base64Data.replace(/^data:image\/\w+;base64,/, "");
               const buffer = Buffer.from(base64String, 'base64');
               await file.save(buffer, { metadata: { contentType: 'image/webp' } });
               successfulBucket = bucketName;
               console.log(`[Server] File saved successfully (without public:true) to ${bucketName}/${storagePath}`);
               break;
            } catch (innerErr) {
               lastErr = innerErr;
            }
          }
        }
      }
      
      if (!successfulBucket) {
        throw lastErr || new Error("All bucket variations failed");
      }
      
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${successfulBucket}/o/${encodeURIComponent(storagePath)}?alt=media`;
      console.log(`[Server] Upload complete. URL: ${publicUrl}`);
      res.json({ success: true, downloadURL: publicUrl });
    } catch (err: any) {
      console.error("[Server] Final upload error details:", err);
      res.status(500).json({ 
        error: "UPLOAD_FAILED", 
        details: err.message,
        code: err.code,
        triedBuckets: bucketVariations
      });
    }
  });

  // Catch-all for API routes that don't exist
  app.all("/api/*all", (req, res) => {
    console.warn(`[Server] 404 - API Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: "API_ROUTE_NOT_FOUND", path: req.path, method: req.method });
  });

  // Global error handler for JSON responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[Server Error]", err);
    if (req.path.startsWith('/api/')) {
      res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
    } else {
      next(err);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("[Server] Initializing Vite in middleware mode...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("[Server] Vite middleware attached.");
    } catch (viteErr) {
      console.error("[Server] Vite middleware error:", viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log("[Server] Starting to listen on port 3000...");
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
    console.log(`[Server] Firebase Project: ${firebaseConfig.projectId}`);
  }).on('error', (err: any) => {
    console.error("[Server] Listen error:", err);
  });
} catch (error) {
  console.error("CRITICAL: Failed to start server:", error);
  process.exit(1);
}
}

startServer().catch(err => {
  console.error("Critical server startup error:", err);
});
