# OpenElara Cloud - Agent Setup Guide

This guide provides the definitive steps to provision, configure, and deploy your own sovereign instance of the OpenElara Cloud AI Assistant.

## Core Philosophy: Sovereignty

This project is designed so that YOU are in complete control. All infrastructure, data, and models are provisioned under your own Google Cloud account. There is no middleman, and no data is shared.

## Prerequisites

1.  **A Google Account:** This is required to create your Google Cloud project.
2.  **Node.js:** Ensure you have Node.js version 20.0.0 or higher installed.
3.  **A Code Editor:** Visual Studio Code is recommended.

## Setup Workflow

The setup process is broken down into three main stages:

1.  **Infrastructure Provisioning:** Create the necessary cloud resources (Firebase, Firestore, etc.).
2.  **Application Configuration:** Connect the application code to your new infrastructure.
3.  **Database Seeding:** Initialize the database with the AI's core knowledge.
4.  **Deployment:** Build and deploy the application.

---

### Step 1: Infrastructure Provisioning (The Sovereign Commander)

This step uses a guided script to create and configure your Google Cloud project and Firebase application. It is the most critical step to establishing sovereignty.

1.  **Open a PowerShell Terminal:** Open a new PowerShell terminal on your local machine.
2.  **Navigate to the Project Directory:** Change directory into the `openElaraCloud` folder of this project.
3.  **Execute the Sovereign Commander:** Run the following command:

    ```powershell
    ./scripts/sovereign-commander.ps1
    ```

4.  **Follow the Prompts:** The script will guide you through:
    *   Logging into your Google Cloud account.
    *   Creating a new Google Cloud project (or selecting an existing one).
    *   Linking a billing account (required for all Google Cloud services).
    *   Enabling the necessary APIs.
    *   Linking the project to the Firebase CLI.

Upon completion, your entire cloud backend is provisioned and ready.

---

### Step 2: Application Configuration

This step connects the application code to the infrastructure you just created by generating a secure environment file.

1.  **Stay in the `openElaraCloud` Directory:** Ensure your terminal is still in the `openElaraCloud` folder.
2.  **Run the Firebase SDK Config Command:** Execute the following command:

    ```bash
    firebase apps:sdkconfig -o .env.local
    ```

This command automatically queries your Firebase project for its configuration keys (API key, project ID, etc.) and securely saves them to a `.env.local` file. The application will use this file to connect to your backend.

---

### Step 3: Database Seeding (Critical Integrity Test)

Before running the application for the first time, you must seed the database. This process injects the AI's core self-awareness document (the User Manual) into the knowledge base (RAG system). This ensures the AI knows its own functions and purpose from the very first boot.

1.  **Run the Database Seeding Command:** Execute the following from the `openElaraCloud` directory:

    ```bash
    npm run db:seed
    ```

2.  **Verify the Output:** The script will connect to your new Firestore database and add the user manual. A success message will be displayed upon completion. If you encounter errors, check the security rules in your Firebase console for the Firestore database.

---

### Step 4: Run and Deploy

With the infrastructure provisioned, the application configured, and the database seeded, you are ready to run and deploy OpenElara.

**To run in development mode:**

```bash
npm run dev
```

**To build for production and deploy:**

1.  **Build the application:**
    ```bash
    npm run build
    ```
2.  **Deploy to Firebase Hosting:**
    ```bash
    firebase deploy
    ```

Congratulations! Your sovereign AI assistant is now deployed and running on your own infrastructure.
