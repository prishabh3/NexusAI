#!/usr/bin/env python3
"""Generate realistic sample datasets for NexusAI demos."""
import csv
import json
import random
from datetime import date, timedelta
from pathlib import Path

RANDOM_SEED = 42
random.seed(RANDOM_SEED)

try:
    import numpy as np
    import pandas as pd
    HAS_NUMPY = True
    np.random.seed(RANDOM_SEED)
except ImportError:
    HAS_NUMPY = False

OUT = Path(__file__).parent


def date_range(start: str, days: int) -> list[str]:
    d = date.fromisoformat(start)
    return [(d + timedelta(days=i)).isoformat() for i in range(days)]


def generate_ecommerce_sales() -> None:
    """E-commerce sales dataset — good for forecasting + correlation analysis."""
    dates = date_range("2023-01-01", 365)
    regions = ["North", "South", "East", "West", "Central"]
    categories = ["Electronics", "Clothing", "Books", "Home", "Sports"]
    rows = []

    for i, d in enumerate(dates):
        for region in regions:
            base = 5000 + (i / 365) * 2000  # upward trend
            seasonal = 1500 * (0.5 + 0.5 * abs((i % 365 - 180) / 180))
            noise = random.gauss(0, 300)
            revenue = max(0, base + seasonal + noise)
            orders = max(1, int(revenue / random.uniform(45, 65)))

            # Inject anomalies
            if random.random() < 0.02:
                revenue *= random.uniform(3, 5)
                orders = int(orders * 1.5)

            rows.append({
                "date": d,
                "region": region,
                "category": random.choice(categories),
                "revenue": round(revenue, 2),
                "orders": orders,
                "avg_order_value": round(revenue / orders, 2),
                "return_rate": round(random.uniform(0.02, 0.15), 3),
                "discount_pct": round(random.uniform(0, 0.3), 2),
                "customer_satisfaction": round(random.uniform(3.0, 5.0), 1),
            })

    with open(OUT / "ecommerce_sales.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated ecommerce_sales.csv — {len(rows)} rows")


def generate_customer_churn() -> None:
    """Customer churn dataset — good for classification + anomaly detection."""
    rows = []
    for i in range(2000):
        tenure = random.randint(1, 72)
        monthly_charge = round(random.uniform(20, 120), 2)
        total_charge = round(monthly_charge * tenure * random.uniform(0.9, 1.1), 2)
        num_products = random.randint(1, 5)
        support_calls = random.randint(0, 10)
        late_payments = random.randint(0, int(tenure / 6))

        churn_prob = (
            0.1
            + (1 - tenure / 72) * 0.3
            + (monthly_charge / 120) * 0.2
            + (support_calls / 10) * 0.2
            + (late_payments / max(1, tenure / 6)) * 0.2
        )
        churn_prob = max(0, min(1, churn_prob + random.gauss(0, 0.1)))
        churned = int(churn_prob > 0.5)

        rows.append({
            "customer_id": f"CUST{i+1:05d}",
            "tenure_months": tenure,
            "monthly_charges": monthly_charge,
            "total_charges": total_charge,
            "num_products": num_products,
            "support_calls_6m": support_calls,
            "late_payments": late_payments,
            "contract_type": random.choice(["Month-to-month", "One year", "Two year"]),
            "payment_method": random.choice(["Credit card", "Bank transfer", "Electronic check", "Mailed check"]),
            "internet_service": random.choice(["DSL", "Fiber optic", "No"]),
            "online_security": random.choice(["Yes", "No", "No internet"]),
            "age_group": random.choice(["18-25", "26-35", "36-50", "51-65", "65+"]),
            "churned": churned,
        })

    with open(OUT / "customer_churn.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated customer_churn.csv — {len(rows)} rows")


def generate_inventory_data() -> None:
    """Inventory management dataset — good for anomaly + forecasting."""
    products = [f"PROD{i:04d}" for i in range(1, 51)]
    warehouses = ["WH-NORTH", "WH-SOUTH", "WH-EAST"]
    dates = date_range("2024-01-01", 180)
    rows = []

    for product in products:
        base_demand = random.randint(50, 500)
        for d in dates:
            demand = max(0, int(base_demand + random.gauss(0, base_demand * 0.2)))
            stock = max(0, int(base_demand * random.uniform(0.5, 3.0)))

            # Stockout anomaly
            if random.random() < 0.03:
                stock = 0

            rows.append({
                "date": d,
                "product_id": product,
                "warehouse": random.choice(warehouses),
                "stock_level": stock,
                "daily_demand": demand,
                "units_ordered": max(0, demand - stock // 3) if stock < demand * 7 else 0,
                "lead_time_days": random.randint(2, 14),
                "unit_cost": round(random.uniform(5, 200), 2),
                "days_of_supply": round(stock / max(1, demand), 1),
                "stockout_risk": 1 if stock < demand * 3 else 0,
            })

    with open(OUT / "inventory_management.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated inventory_management.csv — {len(rows)} rows")


def generate_financial_transactions() -> None:
    """Financial transactions — designed to have fraud anomalies."""
    rows = []
    for i in range(5000):
        amount = round(random.lognormvariate(4, 1.5) if HAS_NUMPY else random.expovariate(0.001), 2)
        is_fraud = random.random() < 0.015

        if is_fraud:
            amount = round(random.uniform(5000, 50000), 2)

        rows.append({
            "transaction_id": f"TXN{i+1:06d}",
            "timestamp": f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d}T{random.randint(0,23):02d}:{random.randint(0,59):02d}:00",
            "amount": amount,
            "merchant_category": random.choice(["grocery", "restaurant", "retail", "online", "travel", "healthcare"]),
            "payment_method": random.choice(["credit", "debit", "digital_wallet"]),
            "country": random.choice(["US", "UK", "CA", "DE", "FR", "JP", "AU"]),
            "customer_age": random.randint(18, 80),
            "transaction_hour": random.randint(0, 23),
            "is_weekend": int(random.random() < 0.28),
            "distance_from_home_km": round(random.expovariate(0.1), 1),
            "is_fraud": int(is_fraud),
        })

    with open(OUT / "financial_transactions.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated financial_transactions.csv — {len(rows)} rows")


if __name__ == "__main__":
    print("Generating sample datasets...")
    generate_ecommerce_sales()
    generate_customer_churn()
    generate_inventory_data()
    generate_financial_transactions()
    print("\nDone! All sample datasets written to:", OUT)
