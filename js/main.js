const dataPath = "./data/";

const yx = L.latLng;
function xy(x, y) {
	if (Array.isArray(x)) { // when doing xy([x, y])
		return yx(x[1], x[0]);
	}
	return yx(y, x);
}

function capitalise(str) {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

async function fetchData(path) {
	const response = await fetch(path);
	return await response.json();
}


const dogData = `${dataPath}20170308hundehalter.csv`;
const geoData = `${dataPath}stzh.adm_statistische_quartiere_map.geojson`;

main();

function main() {
	const centre = L.latLng(47.37815, 8.541079,);

	const bndSW = L.latLng(47.31, 8.44);
	const bndNE = L.latLng(47.44, 8.63);

	const map = L.map('map', {
		inertia: true,
		minZoom: 13,
		maxBounds: L.latLngBounds(bndSW, bndNE),
		maxBoundsViscosity: 1.0,
	}).setView(centre, 13);

	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 16,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(map);

	let districts = null;
	fetch(geoData)
      .then(response => response.json())
      .then(data => {
		districts = L.geoJSON(data, {
			style: function (feature) {
				return {
					color: "#FF0000",     // Red border
					weight: 3,            // Thick border
					opacity: 0.9,
					fillColor: "#FFFFFF", // White fill
					fillOpacity: 0.2      // Almost transparent
				};
			}
		}).bindPopup(function (layer) {
			return layer.feature.properties.description;
		}).addTo(map);
	}).catch(error => {
		console.error('Error loading GeoJSON:', error);
    });

	function onMapClick(e) {
        L.popup()
            .setLatLng(e.latlng)
            .setContent(`${e.latlng.toString()}`)
            .openOn(map);
    }

    map.on('click', onMapClick);
}
