import { render, screen } from "@testing-library/react";
import uaeMarkers from "../data/uaeMarkers";

// Mock react-leaflet — it requires a real browser DOM
jest.mock("react-leaflet", () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  TileLayer:    () => <div />,
  Marker:       ({ children }) => <div data-testid="marker">{children}</div>,
  Popup:        ({ children }) => <div>{children}</div>,
}));

// Mock leaflet itself
jest.mock("leaflet", () => ({
  Icon: {
    Default: {
      prototype: { _getIconUrl: jest.fn() },
      mergeOptions: jest.fn(),
    },
  },
}));

import MapView from "./MapView";

test("renders map container", () => {
  render(<MapView markers={uaeMarkers} />);
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

test("renders all 50 markers", () => {
  render(<MapView markers={uaeMarkers} />);
  expect(screen.getAllByTestId("marker")).toHaveLength(50);
});

test("renders only filtered markers", () => {
  const dubaiMarkers = uaeMarkers.filter(m => m.city === "Dubai");
  render(<MapView markers={dubaiMarkers} />);
  expect(screen.getAllByTestId("marker")).toHaveLength(dubaiMarkers.length);
});

test("renders zero markers when list is empty", () => {
  render(<MapView markers={[]} />);
  expect(screen.queryAllByTestId("marker")).toHaveLength(0);
});
