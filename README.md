# Random Forest Phishing Detection Browser Extension

A Chrome browser extension that integrates machine learning-based phishing detection directly into a password manager. The system uses a Random Forest classifier to identify phishing URLs in real-time and alerts users with risk indicators.

**GitHub Repository:** [khairulrezz4/Random-Forest-Phishing-Detection-on-Browser-Password-Manager-Extension-2025](https://github.com/khairulrezz4/Random-Forest-Phishing-Detection-on-Browser-Password-Manager-Extension-2025)

---

## 🎯 Project Overview

This project combines:
- **Machine Learning**: Random Forest classifier trained on 604K+ URLs (65% benign, 35% phishing)
- **Browser Extension**: React-based UI for password management with phishing alerts
- **Local Server**: Flask backend serving ML predictions with real-time threat assessment
- **Encryption**: End-to-end encryption for stored credentials

### Key Features
✅ Real-time phishing URL detection  
✅ Password vault with encryption  
✅ Risk indicator with color-coded warnings  
✅ Login form detection  
✅ Browser history analysis  
✅ Detailed threat scoring  

---

## 📦 Large Files (Google Drive)

The following files exceed GitHub's size limits and are hosted on Google Drive. Download and place them in the project root:

| File | Size | Location | Download |
|------|------|----------|----------|
| **tarun_tiwari_dataset_balanced.csv** | ~1.5GB | Project root | [Download](https://drive.google.com/uc?id=1MC1LI2pQVxpDQwN8aiIi_r7VWnS0nV2b) |
| **model.pkl** | ~646MB | `ML/` folder | [Download](https://drive.google.com/uc?id=1qG87kUzN2EruF1OA7X5FFvc2Xds0jOiA) |

**Setup Instructions:**
```bash
# After downloading from Google Drive, place files at:
# 1. tarun_tiwari_dataset_balanced.csv -> project_root/tarun_tiwari_dataset_balanced.csv
# 2. model.pkl                          -> project_root/ML/model.pkl
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 14+
- Google Chrome/Chromium browser
- Git

### 1. Clone Repository
```bash
git clone https://github.com/khairulrezz4/Random-Forest-Phishing-Detection-on-Browser-Password-Manager-Extension-2025.git
cd Random-Forest-Phishing-Detection-on-Browser-Password-Manager-Extension-2025
```

### 2. Download Large Files from Google Drive
Download the two files from Google Drive links above and place them in correct locations.

### 3. Setup ML Backend
```bash
cd ML
pip install -r requirements.txt
python server.py
# Server will start on http://localhost:5000
```

### 4. Setup Browser Extension
```bash
cd rf-password-manager
npm install
npm run build
```

Then load in Chrome:
1. Open `chrome://extensions`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select `rf-password-manager/dist` folder

---

## 📊 Project Structure

```
├── README.md                              # This file
├── PROJECT_MODEL_AND_DATASET.md          # Dataset documentation
├── TESTING_EXECUTION_GUIDE.md            # Testing instructions
├── CHAPTER_4_SYSTEM_DEVELOPMENT.md       # Development details
│
├── ML/                                   # Machine Learning Pipeline
│   ├── server.py                         # Flask prediction server
│   ├── pipeline_phishing.py              # Training & evaluation pipeline
│   ├── model.pkl                         # Trained model (from Google Drive)
│   ├── model_config.json                 # Configuration & thresholds
│   ├── requirements.txt                  # Python dependencies
│   ├── metrics_report.txt                # Training metrics
│   └── best_params.json                  # Best hyperparameters
│
├── rf-password-manager/                  # React Browser Extension
│   ├── public/
│   │   ├── manifest.json                 # Chrome extension manifest
│   │   ├── background.js                 # Background script
│   │   ├── detectLogin.js                # Login detection
│   │   └── icons/                        # Extension icons
│   ├── src/
│   │   ├── App.jsx                       # Main app
│   │   ├── components/                   # UI components
│   │   └── utils/
│   │       ├── api.js                    # Server API client
│   │       ├── encryption.js            # AES-256 encryption
│   │       ├── chrome.js                # Chrome API wrapper
│   │       ├── pinAuth.js               # PIN authentication
│   │       └── eventLogger.js           # Event logging
│   ├── package.json
│   └── vite.config.js
│
├── docs/                                 # Diagrams & documentation
│   ├── system_architecture.puml
│   └── activity_diagram.puml
│
├── tarun_tiwari_dataset_balanced.csv    # Main dataset (from Google Drive)
└── phishing_site_urls.csv
```

---

## 🤖 Machine Learning Pipeline

### Features Used
The model uses **27 features** extracted from URLs:
- Lexical features (URL length, domain length, etc.)
- Structural features (slashes, dots, hyphens, etc.)
- Entropy-based features
- Keyword presence detection
- Special character analysis

See `ML/metrics_report.txt` for complete feature list.

### Model
- **Algorithm:** Random Forest Classifier
- **Features:** 30+ lexical, structural, and entropy-based features
- **Output:** `ML/model.pkl`

### Training
```bash
cd ML
python pipeline_phishing.py --n-iter 20 --cores 12 --cache-features
```

This will generate:
- `model.pkl` - Trained classifier
- `metrics_report.txt` - Performance metrics
- `feature_importance.png` - Feature visualization
- `roc_curve.png` - ROC curve
- `best_params.json` - Hyperparameters

### Configuration
Edit `ML/model_config.json`:
```json
{
  "phishing_threshold": 0.5,
  "feature_cache_dir": "feature_cache",
  "fast_extract": true
}
```

**Threshold Logic:**
- Probability **≥ 0.5** → **PHISHING** (unsafe) 🔴
- Probability **< 0.5** → **LEGITIMATE** (safe) 🟢

**Adjust threshold for different sensitivity:**
- `0.3` = More aggressive (catch more phishing, more false positives)
- `0.5` = Balanced (recommended)
- `0.7` = More lenient (fewer false positives, miss some phishing)

---

## 🔌 Extension API

### Server Endpoints

#### POST `/predict_url`
Predict if a single URL is phishing.

**Request:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "url": "https://example.com",
  "prediction": 0,
  "probability": 0.15,
  "phishing_label": "legitimate",
  "threshold": 0.5,
  "features": { ... },
  "feature_importance": { "url_length": 0.25, ... },
  "timestamp": "2026-02-04T10:30:00"
}
```

**Prediction Logic:**
- `probability >= threshold` (0.5) → `phishing_label: "phishing"`
- `probability < threshold` (0.5) → `phishing_label: "legitimate"`

#### POST `/predict_batch`
Predict multiple URLs in one request.

**Request:**
```json
{
  "urls": ["https://example.com", "https://google.com"]
}
```

**Response:**
```json
{
  "results": [
    { "url": "...", "prediction": 0, ... },
    { "url": "...", "prediction": 1, ... }
  ],
  "count": 2
}
```

#### GET `/health`
Check server and model status.

**Response:**
```json
{
  "status": "healthy",
  "model_type": "model",
  "model_loaded": true,
  "feature_count": 27,
  "phishing_threshold": 0.5,
  "cache_size": 150,
  "timestamp": "2026-02-04T10:30:00"
}
```

---

## 🛡️ Extension Features

### Password Vault
- AES-256 encryption
- PIN-based access control
- Master password protection
- Auto-clear on timeout

### Real-time Risk Assessment
- URL analysis on every login
- Color-coded risk indicators:
  - 🟢 Green: Safe (probability < 0.5)
  - 🔴 Red: Phishing (probability ≥ 0.5)
- Detailed threat scoring

### Login Detection
- Automatic form detection
- URL validation before submission
- Security event logging

---

### Requirements

**Python (ML Backend)**
```
flask==3.0.3
flask-cors==4.0.0
scikit-learn==1.5.2
pandas==2.2.2
numpy==1.26.4
joblib==1.4.2
matplotlib==3.9.0
seaborn==0.13.2
requests==2.32.3
```

**Node.js (Browser Extension)**
```
react@^19.1.1
react-dom@^19.1.1
vite@^7.1.7
lucide-react@^0.553.0
```

---

## 🧪 Testing

### ML Tests
```bash
cd ML
python test_openphish.py        # Test on live phishing URLs
python test_batch.py            # Batch prediction test
```

### Extension Tests
```bash
cd rf-password-manager
npm run build
```

See [TESTING_EXECUTION_GUIDE.md](TESTING_EXECUTION_GUIDE.md) for detailed procedures.

---

## 📈 Performance

### Model Metrics
- **Validation Accuracy:** 94.6%
- **Validation Precision:** 95.1%
- **Validation Recall:** 89.3%
- **Validation F1-Score:** 0.921
- **Test Accuracy:** 94.8%
- **Test Precision:** 95.3%
- **Test Recall:** 89.5%
- **Test F1-Score:** 0.923
- **ROC-AUC:** 0.984

See `ML/metrics_report.txt` for full details.

### Server Performance
- Prediction latency: 50-100ms per URL
- Batch processing: Up to 100 URLs per request
- Prediction caching: 30-minute TTL on recent URLs
- Cache size: 1000 recent URLs in memory
- Memory: ~2GB (model + features)

---

## 🔐 Security Best Practices

✅ Use strong PINs (minimum 6 digits)  
✅ Keep Chrome and extension updated  
✅ Enable browser security extensions  
✅ Review stored passwords regularly  
✅ Local-only storage (no cloud sync)  

---

## 📚 Documentation

- [PROJECT_MODEL_AND_DATASET.md](PROJECT_MODEL_AND_DATASET.md) - Dataset & model details
- [TESTING_EXECUTION_GUIDE.md](TESTING_EXECUTION_GUIDE.md) - Testing procedures
- [CHAPTER_4_SYSTEM_DEVELOPMENT.md](CHAPTER_4_SYSTEM_DEVELOPMENT.md) - Development notes

---

## 🚧 Troubleshooting

### Server won't start
```bash
# Verify model file exists
ls ML/model.pkl

# Check Python dependencies
pip install -r ML/requirements.txt

# Run with debug output
python ML/server.py --debug
```

### Extension not detecting predictions
1. Ensure `python ML/server.py` is running
2. Check browser console: F12 → Console tab
3. Verify `http://localhost:5000/health` is accessible

### Model prediction errors
1. Verify `tarun_tiwari_dataset_balanced.csv` is downloaded
2. Check `ML/model_config.json` exists
3. See `ML/metrics_report.txt` for model info

---

## 👨‍💼 Author

**Khairul Rezza Bin Razmi**  
Email: khairul.razmi01@s.unikl.edu.my  
GitHub: [@khairulrezz4](https://github.com/khairulrezz4)
LinkedIn: https://www.linkedin.com/in/khairul-rezza-razmi-9293b42a9/

---

## 📄 License

This project was developed for Final Year Project 2 subject and under Universiti Kuala Lumpur's student supervision.

---

## 🙏 Acknowledgments

- **Tarun Tiwari** - Phishing/benign URL dataset
- **PhiUSIIL** - Phishing dataset  
- **scikit-learn** - ML framework
- **React** - UI framework
- **Flask** - Web framework

---

**Last Updated:** February 3, 2026  
**Status:** Active Development
