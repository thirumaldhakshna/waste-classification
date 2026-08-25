# ♻️ Smart Waste Scanner

A web-based, AI-powered application that uses the device camera to classify waste as **Biodegradable** or **Non-Biodegradable** in real-time. It features a responsive, mobile-first design, bilingual audio instructions (English & Tamil), and live confidence tracking.

## 🚀 Features

- **Real-Time Classification**: Instantly detects and categorizes waste through your device's camera.
- **Bilingual Voice Feedback**: Provides auditory instructions in English (`en`) and Tamil (`ta-IN`) using local audio files.
- **Visual Feedback**: The result panel dynamically changes colors (Green for Biodegradable, Blue for Non-Biodegradable) and animates a dustbin filling up based on AI confidence.
- **Responsive Dashboard**: Features a compact, modern UI that gracefully adapts from desktop to mobile screens, ensuring the camera feed and result panel are always easily visible.
- **Privacy First**: Fully client-side inference. No images are uploaded to any server.

## 🧠 How It Works (The Algorithm)

This project leverages **TensorFlow.js** and a custom model trained via Google's **Teachable Machine**. 

Under the hood, the model uses **MobileNetV2**, a lightweight, highly efficient convolutional neural network architecture optimized for mobile and embedded vision applications. 
We used **Transfer Learning** to retrain the final layers of the MobileNetV2 model on our specific dataset of Biodegradable (e.g., food scraps, paper, leaves) and Non-Biodegradable (e.g., plastic bottles, wrappers, metal) items. 

### Model Performance & Accuracy
- **Base Architecture**: MobileNetV2
- **Training Method**: Transfer Learning (Teachable Machine)
- **Measured Accuracy**: *Consistently achieves high accuracy (>90%) on well-lit items against clear backgrounds.* (Note: Accuracy heavily depends on lighting and camera quality).

## 🛠️ How to Run Locally

Because this project uses the device camera and fetches local files (like the `model.json` and audio `.mp3` files), it **cannot** be run by simply double-clicking the `index.html` file (due to browser CORS restrictions).

You must serve it via a local web server:

1. **Using Node.js / NPX:**
   Open your terminal in the project folder and run:
   ```bash
   npx serve .
   ```
   Then navigate to `http://localhost:3000` in your browser.

2. **Using Python:**
   Open your terminal in the project folder and run:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000` in your browser.

3. **Using VS Code:**
   Install the "Live Server" extension, right-click `index.html`, and select "Open with Live Server".

## 🌐 Hosting and Deployment

To grant the website access to your phone's camera, the site **must** be served over a secure HTTPS connection. The easiest way to achieve this is by hosting the project for free on **GitHub Pages** or **Vercel**. (See deployment instructions for step-by-step guides).

## 📁 File Structure

- `index.html`: The core UI and layout structure.
- `style.css`: The styling rules, animations, and responsive media queries.
- `app.js`: The application logic, TensorFlow.js integration, webcam handling, and audio management.
- `assets/`: Contains the trained `model.json`, `metadata.json`, `weights.bin`, and the `.mp3` audio files.
