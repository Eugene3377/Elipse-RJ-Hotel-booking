<<<<<<< HEAD
# Eclipse RJ Hotel Booking

A static hotel booking website for browsing Ghana hotel stays, choosing a room, reviewing checkout details, and viewing a booking confirmation.

## Features

- Responsive landing page with hero video, destination cards, rooms, amenities, and guest experience sections
- Hotel search results with filtering, sorting, map markers, and local Ghana hotel data
- Room details page with pricing, guest count, dates, policies, and suite information
- Checkout page with guest details, payment summary, booking terms, and confirmation flow
- Booking confirmation page with receipt-style details
- Lightweight session-based authentication and booking state using `sessionStorage`
- No build step required

## Project Structure

```text
Elipse RJ Hotel booking/
  index.html          Home page
  search.html         Hotel search and map results
  room.html           Room details and date selection
  checkout.html       Guest details and payment summary
  confirmation.html   Booking confirmation and receipt
  main.js             Shared interactions and booking state
  style.css           Site styling
  Images/             Image assets
  video/              Video assets
```

## Run Locally

Open `index.html` in a browser.

For the most reliable local preview, start a small static server from this folder:

```bash
python -m http.server 3000
```

Then open `http://localhost:3000`.

## GitHub Pages

This project can be hosted as a static site. Push the folder to GitHub, then enable GitHub Pages using the repository root as the source.

## Notes

- Keep the `Images/` and `video/` folders with the HTML files because the pages reference those relative paths.
- No API keys are required for the current static version.
=======
# Elipse-RJ-Hotel-booking
Eclipse RJ Hotel Booking is a premium, static web application built with HTML, Vanilla CSS, and JavaScript that provides a luxury hotel search, suite details, checkout, and session-based booking flow for high-end properties across Ghana.
>>>>>>> c49a9000083472913be8f95970e662eb7601c9e2
