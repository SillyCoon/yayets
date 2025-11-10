# Running Route Generator

A web application that generates running routes and tracks your progress using OpenStreetMap and device location services.

## Features

- Generate custom running routes based on desired distance
- Track your location and progress in real-time
- Show viewing direction with compass integration
- Auto-rotate map based on your direction
- Display current distance and time while running

## Setup

1. Clone this repository
2. Copy `config.template.js` to `config.js`
3. Sign up at [OpenRouteService](https://openrouteservice.org/) to get an API key
4. Add your API key to `config.js`

## Deployment to GitHub Pages

This project is set up to automatically deploy to GitHub Pages. To set it up:

1. Push this repository to GitHub
2. Go to your repository's Settings
3. Navigate to "Secrets and variables" → "Actions"
4. Add a new secret:
   - Name: `ORS_API_KEY`
   - Value: Your OpenRouteService API key
5. Go to "Pages" in the settings
6. Under "Build and deployment":
   - Source: "GitHub Actions"
7. The site will be deployed automatically when you push to the main branch

## Development

Simply open `index.html` in your browser to run the application locally.

## Privacy Note

Your API key is stored securely in GitHub Secrets and is only used during deployment. The `config.js` file containing your local API key is git-ignored and will not be committed to the repository.