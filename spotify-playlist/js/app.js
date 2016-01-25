var Spotify = require('spotify-web-api-js');
var Vue = require('vue');
var _ = require('lodash');
var Q = require('Q');
var swal = require('sweetalert');

module.exports = function() {

	(function() {
		"use strict";

		var config = {
			stateKey: 'spotify_auth_state',
			queryParams: {
				client_id: 'abc15734545043d4a744e4925027e3d4',
				response_type: 'token',
				redirect_uri: 'https://accounts.spotify.com/authorize?',
				scope: 'playlist-read-private playlist-modify-public user-follow-read playlist-read-collaborative',
				state: ''
			},
			redirectUrl: 'https://accounts.spotify.com/authorize?',

			// ajax configuration
			delayBetweenAjaxCalls: 100, 				// how long to wait between ajax calls (ms)
			numberOfArtistsToFetchRelatedFrom: 10, 		// one artist usually has 20 related artists (value * 20)
			artistsToFetch: 15, 						// how many artists to look up related artists from
			artistsToFetchTopSongsFrom: 25,				// how many artists to fetch top songs from, one artist usually has 10 top songs listed
			playlistLimit: 25,							// limit how many playlists we fetch from spotify

			playlistsToFetch: ''						// will be set to the number of the users playlists later down the chain

		}			

		var vm = new Vue({
			el: 'body',

			data: {
				spotifyApi: new Spotify(),
				config: config,
				userAuthenticated: false,
				userId: '',
				artistIds: [],
				relatedArtistsIds: [],
				topTracks: [],
				topTrackIds: {
					uris: []
				},
				audioSource: '',
				currentTrack: {},
				status: {
					loading: false,
					task: ''
				},
				playlistHasBeenSaved: false
			},

			events: {

				// triggered when artist id's have been fetched from the users playlists
				'artistIdsFetched': function() {

					if (! this.artistIds.length) {
					  	return this.$emit('noArtistsFoundInPlaylists');
					}

					// only get unique artists
					var uniqueIds = _.uniq(this.artistIds);

					// if our artistsToFetch limit is met, continue
					if (uniqueIds.length >= this.config.artistsToFetch) {
						this.$set('artistIds', _.take(uniqueIds, this.config.numberOfArtistsToFetchRelatedFrom));

						this.$emit('artistIdsDone');
					} else {

						// too few artists was returned, start over
						return this.fetchArtistIdsFromUserPlaylists();
					}
				},

				// triggered when the related artists ids have been fetched
				'relatedArtistIdsFetched': function() {
					var shuffled = _.shuffle(this.relatedArtistsIds);
					var reduced = _.take(shuffled, this.config.artistsToFetchTopSongsFrom);

					this.$set('relatedArtistsIds', reduced);

					this.$emit('fetchTopTracks');
				},

				// triggered when the related artists top tracks have been fetched
				'topTracksFetched': function(tracks) {
					var tracks = this.transformTracks(tracks);
					tracks = this.shuffleArray(tracks);
					this.topTracks = _.uniqBy(tracks, 'artist_id');

					this.topTrackIds.uris = this.topTracks.map(function(t) { return t.uri; });

					this.status.loading = false;
				},

				// triggered when user plays a track
				'playingTrack': function(track) {
					var self = this;
					return track.addEventListener("ended", function() 
			    	{
			    		return self.currentTrack = {};
			   		});
				},

				'noArtistsFoundInPlaylists': function() {
					//console.log('noArtistsFoundInPlaylists triggered');
					this.$set('status.task', 'Error, are your playlists empty?');

					throw new Error('No artists were found in playlists!');
				},

				'noPlaylistsFound': function() {
					//console.log('noPlaylistsFound triggered');
					this.$set('status.task', 'Error, found no playlists');

					throw new Error('No playlists were found!');
				},								
			},

			methods: {


				/**
					
					AUTH METHODS
				
				**/


				buildQueryString: function(obj) {
					var qs = [];
					for(var p in obj) {
						if (obj.hasOwnProperty(p)) {
					  		qs.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
						}
					}

					return qs.join("&");
				},

				fetchAuth: function() {
					config.queryParams.state = this.generateRandomString(16);
					var params = this.buildQueryString(config.queryParams);
					localStorage.setItem(config.stateKey, config.queryParams.state);

					return window.location.href = config.redirectUrl + params;
				},

				verifyAuth: function() {
					var params = this.getHashParams();
		        	
		        	var access_token = params.access_token,
		            	state = params.state,
		            	storedState = localStorage.getItem(config.stateKey);

			        if (access_token && (state == null || state !== storedState)) {
			        	//console.log('auth failed');
			        	return false;
			        } else {

			        	localStorage.removeItem(config.stateKey);
			          	if (access_token) {

			          		this.userAuthenticated = true;
			          		this.spotifyApi.setAccessToken(access_token);

			          		return true;
			          	} else {
			          		//console.log('auth failed');
			          		return false;
			          	}
			        }
				},

				generateRandomString: function(length) {
					var text = '';
					var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
					for (var i = 0; i < length; i++) {
						text += possible.charAt(Math.floor(Math.random() * possible.length));
					}
					return text;
				},				

		        getHashParams: function() {
		          var hashParams = {};
		          var e, r = /([^&;=]+)=?([^&;]*)/g,
		              q = window.location.hash.substring(1);
		          while ( e = r.exec(q)) {
		             hashParams[e[1]] = decodeURIComponent(e[2]);
		          }
		          return hashParams;
		        },


		        /**
					
					DATA MANIPULATION METHODS
					
		        **/


				getRandomArrayElements: function(arr, n) {
				   var result = new Array(n),
				        len = arr.length,
				        taken = new Array(len);
				    if (n > len)
				        throw new RangeError("getRandom: more elements taken than available");
				    while (n--) {
				        var x = Math.floor(Math.random() * len);
				        result[n] = arr[x in taken ? taken[x] : x];
				        taken[x] = --len;
				    }
				    return _.shuffle(result);
				},

				shuffleArray: function(array) {
				    for (var i = array.length - 1; i > 0; i--) {
				        var j = Math.floor(Math.random() * (i + 1));
				        var temp = array[i];
				        array[i] = array[j];
				        array[j] = temp;
				    }
				    return array;
				},

				millisToMinutesAndSeconds: function(millis) {
				  var minutes = Math.floor(millis / 60000);
				  var seconds = ((millis % 60000) / 1000).toFixed(0);
				  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
				},					

				transformTracks: function(tracks) {
					var transformedTracks = [];
					var self = this;

					for (var i = 0; i < tracks.length; i++) {
						var obj = tracks[i];

						transformedTracks.push({
							popularity: obj.popularity,
							artist: obj.artists[0] ? obj.artists[0].name : '',
							title: obj.name,
							artist_id: obj.artists[0].id,
							preview: obj.preview_url,
							getAudioSource: function() {
								return new Audio(this.preview);
							},
							album: obj.album.name,
							duration: this.millisToMinutesAndSeconds(obj.duration_ms),
							type: obj.type,
							id: obj.id,
							uri: obj.uri,
							thumbnail: obj.album.images[2] ? obj.album.images[2].url : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN49uz/fwAJTAPLQuEFBAAAAABJRU5ErkJggg=='
						});
					}

					return transformedTracks;
				},


				/**

					APPLICATION FLOW METHODS

				**/


				fetchArtistIdsFromUserPlaylists: function() {
					
					if (! _.isEmpty(this.currentTrack)) {
						this.pauseTrack();
					}

					var self = this;
					
					this.playlistHasBeenSaved = false;
					this.topTrackIds.uris = [];
					this.artistIds = [];
					this.status.loading = true;
					this.status.task = 'Fetching user info..';
					this.spotifyApi.setPromiseImplementation(Q);

					// fetch user id
					this.spotifyApi.getMe()
					  .then(function(user) {
							self.userId = user.id;

							//console.log('fetched user id');
					    	return self.userId;
					  })
					  .then(function(userId) {
					  		// fetch user playlists
					  		self.status.task = 'Fetching playlists..';

					  		//console.log('fetching user playlists');
					    	return self.spotifyApi.getUserPlaylists(userId, {limit: self.config.playlistLimit});
					  })
					  .then(function(data) {

					  		var playlistIds = [];

					  		// no playlists found, abort !
					  		if (! data.items.length) {
					  			//console.log('no playlists found');
								self.$emit('noPlaylistsFound');
					  		} 
						  	
					  		data.items.forEach(function(playlist) {
					  			if (playlist.owner.id == self.userId) {
					  				playlistIds.push(playlist.id);
					  			}
					  		});

					  		self.config.playlistsToFetch = playlistIds.length;
					  		
					  		//console.log('fetched playlists, returning ' + self.config.playlistsToFetch + ' random playlists');
					  		return self.getRandomArrayElements(playlistIds, self.config.playlistsToFetch);
					  })
					  .then(function(playlistIds) {

					  		self.status.task = 'Loading your tracks..';
					  		//console.log('fetching artists from each track in returned playlists');

							for (var x = 0, ln = playlistIds.length; x < ln; x++) {
							  setTimeout(function(y) {

									self.spotifyApi.getPlaylistTracks(self.userId, playlistIds[y], {fields: 'items(track(artists(id)))'})
								  	.then(function(data) {

								  		data.items.map(function(item) {
								  			self.artistIds.push(item.track.artists[0].id);
								  		});

								  	})
								  	.then(function() {
							  			
										if (y + 1 == self.config.playlistsToFetch) {
											//console.log('artistIdsFetched event triggered');
											return self.$emit('artistIdsFetched');
										}								  		
								  	})
								  	.catch(function(error) {

										if (y + 1 == self.config.playlistsToFetch) {
											//console.log('artistIdsFetched event triggered');
											return self.$emit('artistIdsFetched');
										}	
								  	});

							  }, x * self.config.delayBetweenAjaxCalls, x);
							}

					  })
					  .catch(function(error) {
					    console.error(error);
					  });					
				},				


				fetchRelatedArtists: function() {
					var self = this;

					//console.log('fetching related artist from ids returned');
					for (var x = 0, ln = this.artistIds.length; x < ln; x++) {
					  setTimeout(function(y) {

							self.spotifyApi.getArtistRelatedArtists(self.artistIds[y])
						  	.then(function(data) {

						  		data.artists.forEach(function(artist) {
						  			self.relatedArtistsIds.push(artist.id);
						  		});

						  	})
						  	.then(function() {
						  		if (y + 1 == self.config.numberOfArtistsToFetchRelatedFrom) {
						  			//console.log('relatedArtistIdsFetched event triggered');
						  			self.$emit('relatedArtistIdsFetched');
						  		}
						  	})
						  	.catch(function(error) {
						  		if (y + 1 == self.config.numberOfArtistsToFetchRelatedFrom) {
						  			//console.log('relatedArtistIdsFetched event triggered');
						  			self.$emit('relatedArtistIdsFetched');
						  		}						  		
						  	});

					  }, x * self.config.delayBetweenAjaxCalls, x);
					}
				},


				fetchTopTracks: function() {

					var self = this;
					var tracks = [];
					
					this.status.task = 'Loading music you might like..';
					//console.log('fetching related artists top tracks');

					this.relatedArtistsIds = _.shuffle(this.relatedArtistsIds);

					for (var x = 0, ln = this.relatedArtistsIds.length; x < ln; x++) {
					  setTimeout(function(y) {

							self.spotifyApi.getArtistTopTracks(self.relatedArtistsIds[y], 'SE')
						  	.then(function(data) {

						  		data.tracks.forEach(function(track) {
						  			tracks.push(track);
						  		});

						  	})
						  	.then(function() {
						  		if (y + 1 == self.config.artistsToFetchTopSongsFrom) {
						  			//console.log('topTracksFetched event triggered, finishing..');
						  			self.$emit('topTracksFetched', tracks);
						  		}
						  	})
						  	.catch(function(error) {
						  		if (y + 1 == self.config.artistsToFetchTopSongsFrom) {
						  			//console.log('topTracksFetched event triggered, finishing..');
						  			self.$emit('topTracksFetched', tracks);
						  		}
						  	});

					  }, x * self.config.delayBetweenAjaxCalls, x);
					}
				},

				savePlaylist: function() {
					var self = this;					

					swal({   
						title: "Playlist name",
						text: "Enter a name:",
						type: "input",
						showCancelButton: true,
						closeOnConfirm: false,
						showLoaderOnConfirm: true,
						animation: "slide-from-top",
						inputPlaceholder: "name"
					}, function(inputValue){
							if (inputValue === false) return false;
							if (inputValue === "") {
								swal.showInputError("You have to enter a name!");
								return false   
							}
							var trackIds = self.topTracks.map(function(t) { return t.id; });

							function handleSuccess() {
								return swal({
											title: "Success!",
											text: "The playlist was saved",
											type: "success",
											showConfirmButton: false,
											timer: 900
										});
							}

							function handleError() {
								return swal("Something went wrong!", "Try again", "error");
							}							

							self.spotifyApi.createPlaylist(self.userId, {name: inputValue})
							.then(function(response) {
								if (response.id) {
									var playlistId = response.id;
									var userId = self.userId;
									var uris = self.topTrackIds.uris;

									self.spotifyApi.addTracksToPlaylist(userId, playlistId, uris)
									.then(function(response) {
										//console.log(response);
										if (response.snapshot_id) {
											self.playlistHasBeenSaved = true;
											return handleSuccess();
										}
									})
									.catch(function(error) {
										//console.log(error);
										return handleError();
									});
								}
							})
							.catch(function(error) {
								//console.log(error);
								return handleError();
							});
						}
					);
				},


				/**

					PLAY/PAUSE TRACKS

				**/

				
				playTrack: function(track) {

					// if selected track is currently playing, pause and clear
					if (this.audioSource && track == this.currentTrack) {
						this.currentTrack = {}
						return this.audioSource.pause();
					}

					// if a track is playing, stop current track and return the new one
					if (this.audioSource && !this.audioSource.paused) {
						this.pauseTrack();
						this.audioSource = track.getAudioSource();
						this.currentTrack = track;
						this.$emit('playingTrack', this.audioSource);
			
						return this.audioSource.play();
					}

					// else just return the selected track
					this.currentTrack = track;
					this.audioSource = track.getAudioSource();
					this.$emit('playingTrack', this.audioSource);

					return this.audioSource.play();
				},

				pauseTrack: function() {
					this.currentTrack = {};
					return this.audioSource.pause();
				}				
			},

			ready: function() {

				if (this.verifyAuth()) {

					this.fetchArtistIdsFromUserPlaylists();

					this.$on('artistIdsDone', function() {
						this.fetchRelatedArtists();
					});

					this.$on('fetchTopTracks', function() {
						this.fetchTopTracks();
					});								
				}
			}
		});	

	})();
}
