// Function to fetch and display landmark pictures
function getLandmarkPictures() {
    const city = document.getElementById('city').value;
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${city}%20landmarks&format=json&origin=*`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const landmarksDiv = document.getElementById('landmarks');
            landmarksDiv.innerHTML = ''; // Clear previous results

            if (data.query && data.query.search && data.query.search.length > 0) {
                data.query.search.forEach(item => {
                    const imageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|pageterms&format=json&piprop=thumbnail&pithumbsize=300&titles=${encodeURIComponent(item.title)}&origin=*`;

                    fetch(imageUrl)
                        .then(response => response.json())
                        .then(imageData => {
                            const pages = imageData.query.pages;
                            const page = pages[Object.keys(pages)[0]];
                            const imageSrc = page.thumbnail ? page.thumbnail.source : '';
                            const title = page.terms ? page.terms.description[0] : item.title;

                            if (imageSrc) {
                                const landmarkDiv = document.createElement('div');
                                landmarkDiv.className = 'landmark';
                                landmarkDiv.innerHTML = `
                                    <img src="${imageSrc}" alt="${item.title}">
                                    <p>${item.title}</p>
                                `;
                                landmarksDiv.appendChild(landmarkDiv);
                            }
                        })
                        .catch(error => {
                            console.error('Error fetching image:', error);
                        });
                });
            } else {
                landmarksDiv.innerHTML = '<p>No landmarks found.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching landmarks:', error);
            document.getElementById('landmarks').innerHTML = '<p>Error fetching landmarks. Please try again later.</p>';
        });
}
