/* ============================================================
   BantayAni — reference data
   Source: soil test sensor manual (NPK standards, soil pH
   classification) and crop suitable-pH reference tables.
   ============================================================ */

/* Soil pH classification (from manual) */
const PH_SCALE = [
  { max: 4.5, label: "extremely strong acidity", soil: "acidic soil" },
  { max: 5.5, label: "strongly acidic",          soil: "acidic soil" },
  { max: 6.5, label: "acidic",                    soil: "acidic soil" },
  { max: 7.5, label: "neutral",                   soil: "neutral soil" },
  { max: 8.5, label: "alkaline",                  soil: "alkaline soil" },
  { max: 9.5, label: "strongly alkaline",         soil: "alkaline soil" },
  { max: Infinity, label: "extremely alkaline",   soil: "alkaline soil" },
];

/* Sensor definitions — healthy ranges drive graphs + SMS alerts */
const SENSORS = {
  ph:          { name: "Soil pH",            short: "pH",  unit: "",     min: 6.5,  max: 7.5,  decimals: 2, color: "#7ef29d", base: 6.8, drift: 0.25 },
  nitrogen:    { name: "Nitrogen (N)",       short: "N",   unit: "mg/kg", min: 30,   max: 150,  decimals: 1, color: "#4ade80", base: 80,  drift: 8   },
  phosphorus:  { name: "Phosphorus (P)",     short: "P",   unit: "mg/kg", min: 3,    max: 40,   decimals: 1, color: "#facc15", base: 18,  drift: 3   },
  potassium:   { name: "Potassium (K)",      short: "K",   unit: "mg/kg", min: 30,   max: 200,  decimals: 1, color: "#38bdf8", base: 110, drift: 10  },
  moisture:    { name: "Soil Moisture",      short: "Moisture", unit: "%",     min: 40,   max: 70,   decimals: 1, color: "#22d3ee", base: 55,  drift: 6   },
  temperature: { name: "Soil Temperature",   short: "Temp",     unit: "°C",    min: 20,   max: 35,   decimals: 1, color: "#fb923c", base: 27,  drift: 2   },
  ec:          { name: "EC (Salinity)",      short: "EC",  unit: "dS/m",  min: 0.8,  max: 2.0,  decimals: 2, color: "#c084fc", base: 1.3, drift: 0.2 },
};
const SENSOR_KEYS = Object.keys(SENSORS);

/* N·P·K grading standards (from manual) */
const NPK_STANDARDS = {
  nitrogen:   { min: 30, max: 150, level1: 150, level6: 30, ideal: [90, 120], note: "Cultivating soil: 90 – 120 mg/kg" },
  phosphorus: { min: 3,  max: 40,  level1: 40,  level6: 3,  ideal: [10, 20],  note: "Most crops: 10 – 20 mg/kg" },
  potassium:  { min: 30, max: 200, level1: 200, level6: 30, ideal: [150, 200], note: "High-yield farmland: 150 – 200 mg/kg" },
};

/* Fertilizer conversion (estimates):
   deficit mg/kg × 2 ≈ kg/ha of nutrient needed for 0–15 cm topsoil */
const FERTILIZERS = {
  nitrogen:   { product: "Urea (46% N)",           fraction: 0.46 },
  phosphorus: { product: "DAP (18% P₂O₅)",         fraction: 0.18 },
  potassium:  { product: "Muriate of Potash (60% K₂O)", fraction: 0.60 },
};

/* Crop suitable soil pH reference table */
const CROPS = [
  // Vegetables
  { name: "Carrot",         category: "Vegetable", min: 7.0, max: 7.5 },
  { name: "Radish",         category: "Vegetable", min: 5.3, max: 6.5 },
  { name: "Tomato",         category: "Vegetable", min: 6.0, max: 7.0 },
  { name: "Cucumber",       category: "Vegetable", min: 5.5, max: 7.6 },
  { name: "Broccoli",       category: "Vegetable", min: 6.0, max: 6.7 },
  { name: "Kale",           category: "Vegetable", min: 5.5, max: 6.7 },
  { name: "Spinach",        category: "Vegetable", min: 5.5, max: 7.0 },
  { name: "Celery",         category: "Vegetable", min: 6.0, max: 7.6 },
  { name: "Chili",          category: "Vegetable", min: 6.2, max: 7.2 },
  { name: "Eggplant",       category: "Vegetable", min: 6.8, max: 7.3 },
  { name: "Cowpea",         category: "Vegetable", min: 6.2, max: 7.0 },
  { name: "Kidney Bean",    category: "Vegetable", min: 6.2, max: 7.0 },
  { name: "Pea",            category: "Vegetable", min: 6.0, max: 7.2 },
  { name: "Sweet Potato",   category: "Vegetable", min: 5.0, max: 7.0 },
  { name: "Watermelon",     category: "Vegetable", min: 5.0, max: 7.0 },
  { name: "Melon",          category: "Vegetable", min: 6.0, max: 6.8 },
  { name: "Towel Gourd",    category: "Vegetable", min: 6.0, max: 6.5 },
  { name: "Balsam Pear",    category: "Vegetable", min: 5.5, max: 6.5 },
  { name: "Pumpkin",        category: "Vegetable", min: 6.5, max: 7.5 },
  { name: "Wax Gourd",      category: "Vegetable", min: 5.5, max: 7.6 },
  { name: "Squash",         category: "Vegetable", min: 5.5, max: 6.8 },
  { name: "Chinese Cabbage",category: "Vegetable", min: 6.5, max: 7.0 },
  { name: "Lettuce",        category: "Vegetable", min: 5.5, max: 6.5 },
  { name: "Garlic",         category: "Vegetable", min: 5.6, max: 6.6 },
  { name: "Onion",          category: "Vegetable", min: 6.5, max: 7.4 },
  { name: "Turnip",         category: "Vegetable", min: 6.0, max: 7.0 },
  { name: "Potato",         category: "Vegetable", min: 5.5, max: 6.5 },
  { name: "Konjak",         category: "Vegetable", min: 6.5, max: 7.5 },
  { name: "Ginger",         category: "Vegetable", min: 5.5, max: 6.8 },
  // Fruit trees
  { name: "Grape",          category: "Fruit", min: 6.0, max: 7.5 },
  { name: "Strawberry",     category: "Fruit", min: 5.7, max: 6.5 },
  { name: "Litchi",         category: "Fruit", min: 5.5, max: 6.5 },
  { name: "Longan",         category: "Fruit", min: 5.4, max: 6.5 },
  { name: "Chinese Chestnut",category:"Fruit", min: 5.5, max: 6.5 },
  { name: "Pineapple",      category: "Fruit", min: 4.4, max: 6.0 },
  { name: "Banana",         category: "Fruit", min: 5.5, max: 6.5 },
  { name: "Tea Tree",       category: "Fruit", min: 4.0, max: 6.5 },
  { name: "Apple",          category: "Fruit", min: 7.0, max: 7.5 },
  { name: "Citrus",         category: "Fruit", min: 5.5, max: 6.5 },
  { name: "Sugar Orange",   category: "Fruit", min: 5.6, max: 7.0 },
  { name: "Pear",           category: "Fruit", min: 6.0, max: 8.0 },
  { name: "Peach",          category: "Fruit", min: 5.5, max: 7.0 },
  { name: "Walnut",         category: "Fruit", min: 6.5, max: 8.0 },
  { name: "Apricot",        category: "Fruit", min: 6.0, max: 8.0 },
  { name: "Cherry",         category: "Fruit", min: 6.0, max: 8.0 },
  // Grains, oil & medicinal
  { name: "Cotton",         category: "Grain/Oil", min: 6.5, max: 8.0 },
  { name: "Rice Plant",     category: "Grain/Oil", min: 6.0, max: 7.5 },
  { name: "Oilseed Rape",   category: "Grain/Oil", min: 5.8, max: 6.7 },
  { name: "Soybean",        category: "Grain/Oil", min: 6.5, max: 7.0 },
  { name: "Peanut",         category: "Grain/Oil", min: 5.6, max: 6.0 },
  { name: "Corn",           category: "Grain/Oil", min: 6.5, max: 7.0 },
  { name: "Honeysuckle Flower", category: "Grain/Oil", min: 6.5, max: 7.0 },
  { name: "Wheat",          category: "Grain/Oil", min: 5.5, max: 6.5 },
  { name: "Barley",         category: "Grain/Oil", min: 6.8, max: 7.5 },
  { name: "Tobacco",        category: "Grain/Oil", min: 5.0, max: 6.6 },
  { name: "Broad Bean",     category: "Grain/Oil", min: 6.2, max: 7.0 },
  { name: "Sesame",         category: "Grain/Oil", min: 6.0, max: 7.0 },
  { name: "Pseudo-Ginseng", category: "Grain/Oil", min: 5.5, max: 7.0 },
  { name: "Yam",            category: "Grain/Oil", min: 6.5, max: 7.0 },
];
