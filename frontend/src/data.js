export const kpiData = [
  {
    title: "Total Trips",
    value: "1,247,389",
    change: "+12.5%",
    trend: "up",
    data: [40, 30, 45, 60, 55, 70, 65],
  },
  {
    title: "Revenue",
    value: "$3.87M",
    change: "+8.2%",
    trend: "up",
    data: [30, 45, 40, 50, 60, 55, 75],
  },
  {
    title: "Avg. Fare",
    value: "$22.45",
    change: "-1.4%",
    trend: "down",
    data: [25, 24, 23, 22, 23, 22, 21],
  },
];

export const boroughData = [
  { name: "Manhattan", trips: 4000, revenue: 2400 },
  { name: "Brooklyn", trips: 3000, revenue: 1398 },
  { name: "Queens", trips: 2000, revenue: 9800 },
  { name: "Bronx", trips: 2780, revenue: 3908 },
  { name: "Staten Island", trips: 1890, revenue: 4800 },
];

export const trendData = [
  { name: "Jan", trips: 4000 },
  { name: "Feb", trips: 3000 },
  { name: "Mar", trips: 2000 },
  { name: "Apr", trips: 2780 },
  { name: "May", trips: 1890 },
  { name: "Jun", trips: 2390 },
  { name: "Jul", trips: 3490 },
];

export const fareDistData = [
  { range: "$0-10", count: 400 },
  { range: "$10-20", count: 700 },
  { range: "$20-30", count: 500 },
  { range: "$30-40", count: 300 },
  { range: "$40-50", count: 200 },
  { range: "$50+", count: 100 },
];
