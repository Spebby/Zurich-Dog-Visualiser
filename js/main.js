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

	const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 16,
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	});

	var osmHOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    maxZoom: 16,
    attribution: '© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France'});

	const map = L.map('map', {
		inertia: true,
		minZoom: 13,
		maxBounds: L.latLngBounds(bndSW, bndNE),
		maxBoundsViscosity: 1.0,
		layers: [osm]
	}).setView(centre, 13);


	const baseMaps = {
		"OpenStreetMap": osm,
		"OpenStreetMap.HOT": osmHOT
	};
	var layerControl = L.control.layers(baseMaps, {}).addTo(map);

	fetch(geoData)
		.then(response => response.json())
		.then(data => {
		let featureGroup = L.featureGroup();
		districts = L.geoJSON(data, {
			style: function (feature) {
				return {
					color: "#0000FF",
					weight: 2,
					opacity: 0.75,
					fillColor: "#FFFFFF",
					fillOpacity: 0.2
				};
			},
			onEachFeature: function (feature, layer) {
				const center = layer.getBounds().getCenter();
				const qname = feature.properties.qname;

				let labelMarker = L.marker(center, {
					icon: L.divIcon({
					className: 'location',
					html: qname,
					iconSize: [100, 30],
					iconAnchor: [50, 15]
				})});
				featureGroup.addLayer(labelMarker);
				if (feature.properties.description) {
					layer.bindPopup(feature.properties.description);
				}
			}
		});
		featureGroup.addLayer(districts);
		layerControl.addOverlay(featureGroup, "Districts");
		// show it by default
		featureGroup.addTo(map);
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
