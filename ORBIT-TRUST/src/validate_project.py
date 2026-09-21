from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]

def main():
    cfg = yaml.safe_load((ROOT/"configs/default.yaml").read_text())
    required = [
        ROOT/"data/raw/gp",
        ROOT/"data/raw/reference",
        ROOT/"data/raw/environment",
        ROOT/"data/processed",
        ROOT/"data/splits",
        ROOT/"results",
    ]
    missing = [str(p) for p in required if not p.exists()]
    print("ORBIT-TRUST project validation")
    print("Config horizons:", cfg["horizons_hours"])
    print("Required directories:", len(required))
    print("Missing:", missing if missing else "none")
    print("Status:", "READY FOR DATA INGESTION" if not missing else "INCOMPLETE")

if __name__ == "__main__":
    main()
