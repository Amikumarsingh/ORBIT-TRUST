import json

with open('detection.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Restore cell 0 to the original imports
nb['cells'][0]['source'] = (
    "import pandas as pd\n"
    "import numpy as np\n"
    "import seaborn as sns\n"
    "import matplotlib\n"
    "matplotlib.use('Agg')\n"
    "import matplotlib.pyplot as plt\n"
    "from sgp4.api import Satrec, jday\n"
    "from datetime import datetime\n"
    "from sklearn.ensemble import RandomForestClassifier\n"
    "from sklearn.model_selection import train_test_split\n"
    "from sklearn.metrics import accuracy_score, classification_report\n"
    "from imblearn.over_sampling import SMOTE\n"
    "from sklearn.model_selection import cross_val_score\n"
    "from mpl_toolkits.mplot3d import Axes3D\n"
    "from scipy.stats import gaussian_kde\n"
)

# Fix cell 12: drop NaN before SMOTE
nb['cells'][12]['source'] = (
    "df_clean = df.dropna()\n"
    "X = df_clean.drop(columns=['label'])\n"
    "y = df_clean['label']\n"
    "X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)\n"
    "\n"
    "smote = SMOTE(random_state=42)\n"
    "X_train_balanced, y_train_balanced = smote.fit_resample(X_train, y_train)\n"
)

with open('detection.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print("Patched. Cell 0:", repr(nb['cells'][0]['source'][:60]))
print("Cell 12:", repr(nb['cells'][12]['source'][:60]))
