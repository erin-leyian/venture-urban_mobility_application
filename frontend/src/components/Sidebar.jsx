import React, { useState } from "react";
import { Calendar, Sliders, Check } from "lucide-react";

const ALL_BOROUGHS = [
  "Manhattan",
  "Brooklyn",
  "Queens",
  "Bronx",
  "Staten Island",
];

const RangeSlider = ({
  label,
  min,
  max,
  step = 1,
  unit = "",
  values,
  onChange,
}) => {
  const pct = (v) => ((v - min) / (max - min)) * 100;

  const handleLow = (e) => {
    const v = Math.min(Number(e.target.value), values[1] - step);
    onChange([v, values[1]]);
  };
  const handleHigh = (e) => {
    const v = Math.max(Number(e.target.value), values[0] + step);
    onChange([values[0], v]);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-taxi-yellow font-mono text-xs">
          {unit}
          {values[0]} – {unit}
          {values[1]}
          {values[1] >= max ? "+" : ""}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        {/* Track */}
        <div className="absolute w-full h-1 bg-[#333] rounded-full" />
        {/* Active range */}
        <div
          className="absolute h-1 bg-taxi-yellow rounded-full"
          style={{
            left: `${pct(values[0])}%`,
            right: `${100 - pct(values[1])}%`,
          }}
        />
        {/* Low thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={values[0]}
          onChange={handleLow}
          className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer range-thumb z-10"
          style={{ pointerEvents: "none" }}
        />
        {/* High thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={values[1]}
          onChange={handleHigh}
          className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer range-thumb z-20"
          style={{ pointerEvents: "none" }}
        />
        {/* Visual thumb dots */}
        <div
          className="absolute w-4 h-4 bg-white border-2 border-taxi-yellow rounded-full shadow pointer-events-auto cursor-grab"
          style={{ left: `calc(${pct(values[0])}% - 8px)`, zIndex: 30 }}
        />
        <div
          className="absolute w-4 h-4 bg-white border-2 border-taxi-yellow rounded-full shadow pointer-events-auto cursor-grab"
          style={{ left: `calc(${pct(values[1])}% - 8px)`, zIndex: 30 }}
        />
      </div>
    </div>
  );
};

const Sidebar = ({ filters, onApplyFilters }) => {
  const [selectedBoroughs, setSelectedBoroughs] = useState(
    filters?.boroughs ?? ALL_BOROUGHS,
  );
  const [distanceRange, setDistanceRange] = useState([
    filters?.minDistance ?? 0,
    filters?.maxDistance ?? 50,
  ]);
  const [fareRange, setFareRange] = useState([
    filters?.minFare ?? 0,
    filters?.maxFare ?? 250,
  ]);

  const toggleBorough = (borough) => {
    setSelectedBoroughs((prev) =>
      prev.includes(borough)
        ? prev.filter((b) => b !== borough)
        : [...prev, borough],
    );
  };

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters({
        boroughs: selectedBoroughs,
        minFare: fareRange[0],
        maxFare: fareRange[1],
        minDistance: distanceRange[0],
        maxDistance: distanceRange[1],
      });
    }
  };

  return (
    <div className="w-72 h-full bg-charcoal border-r border-[#333] flex flex-col p-5 select-none overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-taxi-yellow flex items-center justify-center text-black font-bold text-xl">
          🚕
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white leading-tight">
            NYC Mobility
          </h1>
          <p className="text-xs text-gray-500">Analytics Dashboard</p>
        </div>
      </div>

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">
        Data Filters
      </p>

      {/* Date Picker */}
      <div className="space-y-2 mb-5">
        <label className="text-xs font-medium text-gray-400">Select Date</label>
        <div className="relative">
          <input
            type="text"
            readOnly
            value="Jan 2019 — Dec 2019"
            className="w-full bg-[#2C2C2E] border border-[#333] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-taxi-yellow transition-colors cursor-pointer"
          />
          <Calendar
            className="absolute right-3 top-3 text-taxi-yellow"
            size={14}
          />
        </div>
      </div>

      {/* Time of Day Histogram */}
      <div className="space-y-2 mb-5">
        <label className="text-xs font-medium text-gray-400">Time of Day</label>
        <div className="h-12 flex items-end justify-between gap-0.5">
          {[
            10, 15, 25, 35, 55, 75, 60, 65, 85, 100, 90, 70, 55, 45, 35, 20, 15,
            25, 60, 80, 70, 50, 35, 20,
          ].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-colors"
              style={{
                height: `${h}%`,
                backgroundColor:
                  (i >= 7 && i <= 10) || (i >= 16 && i <= 19)
                    ? "#FFD700"
                    : "#444",
              }}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-600 font-mono">
          <span>12AM</span>
          <span>6AM</span>
          <span>12PM</span>
          <span>6PM</span>
          <span>11PM</span>
        </div>
      </div>

      {/* Borough Checkboxes */}
      <div className="space-y-2 mb-5">
        <label className="text-xs font-medium text-gray-400">Boroughs</label>
        <div className="space-y-2">
          {ALL_BOROUGHS.map((borough) => (
            <label
              key={borough}
              className="flex items-center cursor-pointer group"
            >
              <div
                className={`w-4.5 h-4.5 w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
                  selectedBoroughs.includes(borough)
                    ? "bg-taxi-yellow border-taxi-yellow text-black"
                    : "border-gray-600 bg-transparent group-hover:border-gray-400"
                }`}
                onClick={() => toggleBorough(borough)}
              >
                {selectedBoroughs.includes(borough) && (
                  <Check size={12} strokeWidth={3} />
                )}
              </div>
              <span
                className={`ml-2.5 text-sm transition-colors ${
                  selectedBoroughs.includes(borough)
                    ? "text-white"
                    : "text-gray-400"
                }`}
              >
                {borough}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Range Sliders */}
      <div className="space-y-5 mb-6">
        <RangeSlider
          label="Trip Distance (miles)"
          min={0}
          max={50}
          step={1}
          values={distanceRange}
          onChange={setDistanceRange}
        />
        <RangeSlider
          label="Fare Range"
          min={0}
          max={250}
          step={5}
          unit="$"
          values={fareRange}
          onChange={setFareRange}
        />
      </div>

      <button
        onClick={handleApply}
        className="w-full py-3 bg-taxi-yellow text-black font-bold rounded-xl shadow-lg hover:bg-yellow-400 active:scale-95 transition-all flex items-center justify-center gap-2 mt-auto"
      >
        <Sliders size={16} />
        Apply Filters
      </button>
    </div>
  );
};

export default Sidebar;
