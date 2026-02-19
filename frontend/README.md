# NYC Urban Mobility Analytics Frontend

This is a high-fidelity frontend implementation for the NYC Urban Mobility Dashboard.

## Features

- **Framework:** React + Vite
- **Styling:** Tailwind CSS with a custom "Charcoal & Taxi Yellow" theme.
- **Visualization:** Recharts for data visualization.
- **Maps:** React Map GL (Mapbox wrapper) with a high-fidelity CSS fallback for development without an API token.
- **Icons:** Lucide React.

## Getting Started

1.  Navigate to the directory:

    ```bash
    cd frontend
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Run the development server:

    ```bash
    npm run dev
    ```

4.  Open your browser at `http://localhost:5173`.

## Mapbox Token

To enable the live interactive map:

1.  Get a token from [Mapbox](https://account.mapbox.com/).
2.  Create a `.env` file in the `frontend` root.
3.  Add: `VITE_MAPBOX_TOKEN=your_token_here`.
4.  Uncomment the `<Map>` component code in `src/components/MapComponent.jsx`.
