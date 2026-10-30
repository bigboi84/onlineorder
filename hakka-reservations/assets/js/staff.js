/**
 * HAKKA Reservations – staff booking screen.
 */
( function () {
	'use strict';

	function el( tag, attrs, children ) {
		var node = document.createElement( tag );
		if ( attrs ) {
			Object.keys( attrs ).forEach( function ( key ) {
				var v = attrs[ key ];
				if ( v === null || v === undefined || v === false ) {
					return;
				}
				if ( key === 'class' ) {
					node.className = v;
				} else if ( key === 'text' ) {
					node.textContent = v;
				} else if ( key.indexOf( 'on' ) === 0 && typeof v === 'function' ) {
					node.addEventListener( key.slice( 2 ), v );
				} else if ( v === true ) {
					node.setAttribute( key, '' );
				} else {
					node.setAttribute( key, v );
				}
			} );
		}
		( children || [] ).forEach( function ( c ) {
			if ( c === null || c === undefined || c === false ) {
				return;
			}
			node.appendChild( typeof c === 'string' ? document.createTextNode( c ) : c );
		} );
		return node;
	}

	function pad( n ) {
		return ( n < 10 ? '0' : '' ) + n;
	}

	function shiftDate( s, days ) {
		var p = s.split( '-' );
		var d = new Date( +p[ 0 ], +p[ 1 ] - 1, +p[ 2 ] + days );
		return d.getFullYear() + '-' + pad( d.getMonth() + 1 ) + '-' + pad( d.getDate() );
	}

	function Staff( root ) {
		this.root = root;
		this.cfg = JSON.parse( root.getAttribute( 'data-hkr-staff' ) );
		this.state = { date: this.cfg.openDate || '', location: 0, status: '', search: '', latestId: 0, pending: 0, open: {} };
		if ( this.cfg.openBooking ) {
			this.state.open[ this.cfg.openBooking ] = true;
			this.highlight = this.cfg.openBooking;
		}
		this.locations = [];
		this.sound = false;
		try {
			this.sound = window.localStorage.getItem( 'hkr_sound' ) === '1';
		} catch ( e ) {}
		this.build();
		this.load();
		this.startPolling();
	}

	Staff.prototype.api = function ( path, opts ) {
		opts = opts || {};
		var self = this;
		return fetch( this.cfg.api.replace( /\/$/, '' ) + path, {
			method: opts.method || 'GET',
			credentials: 'same-origin',
			headers: { 'X-WP-Nonce': this.cfg.nonce, 'Content-Type': 'application/json' },
			body: opts.body ? JSON.stringify( opts.body ) : undefined
		} ).then( function ( res ) {
			return res.json().catch( function () {
				return {};
			} ).then( function ( data ) {
				if ( ! res.ok ) {
					if ( res.status === 401 || res.status === 403 && data && data.code === 'rest_cookie_invalid_nonce' ) {
						self.toast( 'Your session has expired. Reloading…', true );
						setTimeout( function () {
							window.location.reload();
						}, 1500 );
					}
					throw new Error( ( data && data.message ) || 'Something went wrong.' );
				}
				return data;
			} );
		} );
	};

	Staff.prototype.build = function () {
		var self = this;
		this.root.innerHTML = '';
		this.badge = el( 'span', { class: 'hkr-s-badge', hidden: true } );
		this.soundBtn = el( 'button', { type: 'button', class: 'hkr-s-btn hkr-s-btn--ghost', onclick: function () {
			self.sound = ! self.sound;
			try {
				window.localStorage.setItem( 'hkr_sound', self.sound ? '1' : '0' );
			} catch ( e ) {}
			if ( self.sound ) {
				self.beep();
			}
			self.updateSoundBtn();
		} } );
		this.updateSoundBtn();
		var head = el( 'header', { class: 'hkr-s-head' }, [
			el( 'div', {}, [ el( 'h1', { class: 'hkr-s-title' }, [ 'Bookings ', this.badge ] ), el( 'p', { class: 'hkr-s-user', text: this.cfg.user } ) ] ),
			el( 'div', { class: 'hkr-s-head__actions' }, [
				this.soundBtn,
				this.cfg.canEdit ? el( 'button', { type: 'button', class: 'hkr-s-btn', onclick: function () {
					self.editDialog( null );
				} }, [ '+ Add booking' ] ) : null,
				this.cfg.adminUrl ? el( 'a', { class: 'hkr-s-btn hkr-s-btn--ghost', href: this.cfg.adminUrl }, [ 'Admin' ] ) : null,
				el( 'a', { class: 'hkr-s-btn hkr-s-btn--ghost', href: this.cfg.logoutUrl }, [ 'Log out' ] )
			] )
		] );

		this.locSelect = el( 'select', { class: 'hkr-s-input', 'aria-label': 'Location', onchange: function () {
			self.state.location = parseInt( this.value, 10 ) || 0;
			self.load();
		} } );
		this.dateInput = el( 'input', { type: 'date', class: 'hkr-s-input', 'aria-label': 'Date', onchange: function () {
			if ( this.value ) {
				self.state.date = this.value;
				self.load();
			}
		} } );
		var statusOpts = [ [ '', 'All statuses' ], [ 'upcoming_pending', 'All pending (upcoming)' ] ];
		Object.keys( this.cfg.statuses ).forEach( function ( k ) {
			statusOpts.push( [ k, self.cfg.statuses[ k ] ] );
		} );
		this.statusSelect = el( 'select', { class: 'hkr-s-input', 'aria-label': 'Status', onchange: function () {
			self.state.status = this.value;
			self.load();
		} }, statusOpts.map( function ( o ) {
			return el( 'option', { value: o[ 0 ], text: o[ 1 ] } );
		} ) );
		var searchTimer;
		this.searchInput = el( 'input', { type: 'search', class: 'hkr-s-input', placeholder: 'Search name, phone, ref', 'aria-label': 'Search', oninput: function () {
			var v = this.value;
			clearTimeout( searchTimer );
			searchTimer = setTimeout( function () {
				self.state.search = v.trim();
				self.load();
			}, 350 );
		} } );
		var controls = el( 'div', { class: 'hkr-s-controls' }, [
			this.locSelect,
			el( 'div', { class: 'hkr-s-datenav' }, [
				el( 'button', { type: 'button', class: 'hkr-s-btn hkr-s-btn--ghost', 'aria-label': 'Previous day', onclick: function () {
					self.state.date = shiftDate( self.state.date, -1 );
					self.load();
				} }, [ '‹' ] ),
				el( 'button', { type: 'button', class: 'hkr-s-btn hkr-s-btn--ghost', onclick: function () {
					self.state.date = '';
					self.load();
				} }, [ 'Today' ] ),
				el( 'button', { type: 'button', class: 'hkr-s-btn hkr-s-btn--ghost', 'aria-label': 'Next day', onclick: function () {
					self.state.date = shiftDate( self.state.date, 1 );
					self.load();
				} }, [ '›' ] ),
				this.dateInput
			] ),
			this.statusSelect,
			this.searchInput
		] );
		this.summary = el( 'div', { class: 'hkr-s-summary', 'aria-live': 'polite' } );
		this.list = el( 'div', { class: 'hkr-s-list' } );
		this.toasts = el( 'div', { class: 'hkr-s-toasts', 'aria-live': 'assertive' } );
		this.dialog = el( 'dialog', { class: 'hkr-s-dialog' } );
		[ head, controls, this.summary, this.list, this.toasts, this.dialog ].forEach( function ( n ) {
			self.root.appendChild( n );
		} );
	};

	Staff.prototype.updateSoundBtn = function () {
		this.soundBtn.textContent = this.sound ? '🔔 Sound on' : '🔕 Turn on sound';
		this.soundBtn.setAttribute( 'aria-pressed', this.sound ? 'true' : 'false' );
	};

	Staff.prototype.beep = function () {
		try {
			var Ctx = window.AudioContext || window.webkitAudioContext;
			var ctx = this.audio || ( this.audio = new Ctx() );
			[ 0, 0.25, 0.5 ].forEach( function ( delay ) {
				var o = ctx.createOscillator();
				var g = ctx.createGain();
				o.type = 'sine';
				o.frequency.value = 880;
				g.gain.setValueAtTime( 0.0001, ctx.currentTime + delay );
				g.gain.exponentialRampToValueAtTime( 0.4, ctx.currentTime + delay + 0.02 );
				g.gain.exponentialRampToValueAtTime( 0.0001, ctx.currentTime + delay + 0.2 );
				o.connect( g );
				g.connect( ctx.destination );
				o.start( ctx.currentTime + delay );
				o.stop( ctx.currentTime + delay + 0.22 );
			} );
		} catch ( e ) {}
	};

	Staff.prototype.toast = function ( text, warn, onClick ) {
		var t = el( 'div', { class: 'hkr-s-toast' + ( warn ? ' hkr-s-toast--warn' : '' ), role: 'status' }, [ text ] );
		if ( onClick ) {
			t.classList.add( 'is-clickable' );
			t.addEventListener( 'click', onClick );
		}
		this.toasts.appendChild( t );
		setTimeout( function () {
			t.classList.add( 'is-leaving' );
			setTimeout( function () {
				t.remove();
			}, 400 );
		}, 8000 );
	};

	Staff.prototype.setPending = function ( n ) {
		this.state.pending = n;
		this.badge.hidden = ! n;
		this.badge.textContent = n + ' pending';
		document.title = ( n ? '(' + n + ') ' : '' ) + document.title.replace( /^\(\d+\)\s/, '' );
	};

	Staff.prototype.load = function () {
		var self = this;
		var s = this.state;
		var q = '?date=' + encodeURIComponent( s.date ) + '&location=' + s.location + '&status=' + encodeURIComponent( s.status ) + '&search=' + encodeURIComponent( s.search );
		this.list.setAttribute( 'aria-busy', 'true' );
		return this.api( '/staff/bookings' + q ).then( function ( data ) {
			self.list.setAttribute( 'aria-busy', 'false' );
			s.date = data.date;
			self.today = data.today;
			self.dateInput.value = data.date;
			s.latestId = Math.max( s.latestId, data.latestId || 0 );
			self.locations = data.locations || [];
			self.fillLocations();
			self.setPending( data.pending );
			var label = s.search ? 'Search results' : ( s.status === 'upcoming_pending' ? 'All upcoming pending bookings' : data.dateLabel + ( data.date === data.today ? ' (today)' : '' ) );
			self.summary.innerHTML = '';
			self.summary.appendChild( el( 'strong', { text: label } ) );
			self.summary.appendChild( document.createTextNode( ' · ' + data.bookings.length + ' booking' + ( data.bookings.length === 1 ? '' : 's' ) + ' · ' + data.covers + ' guests' ) );
			self.renderList( data.bookings );
		} ).catch( function ( e ) {
			self.list.innerHTML = '';
			self.list.appendChild( el( 'p', { class: 'hkr-s-error', text: e.message } ) );
		} );
	};

	Staff.prototype.fillLocations = function () {
		var self = this;
		var current = String( this.state.location );
		this.locSelect.innerHTML = '';
		if ( this.locations.length > 1 ) {
			this.locSelect.appendChild( el( 'option', { value: '0', text: 'All my locations' } ) );
		}
		this.locations.forEach( function ( l ) {
			var o = el( 'option', { value: String( l.id ), text: l.name } );
			if ( String( l.id ) === current ) {
				o.selected = true;
			}
			self.locSelect.appendChild( o );
		} );
		this.locSelect.hidden = this.locations.length < 2;
	};

	Staff.prototype.renderList = function ( bookings ) {
		var self = this;
		this.list.innerHTML = '';
		if ( ! bookings.length ) {
			this.list.appendChild( el( 'p', { class: 'hkr-s-empty', text: 'No bookings.' } ) );
			return;
		}
		var lastGroup = '';
		var multiDate = this.state.search || this.state.status === 'upcoming_pending';
		bookings.forEach( function ( b ) {
			var group = ( multiDate ? b.dateLabel + ' · ' : '' ) + b.timeLabel;
			if ( group !== lastGroup ) {
				self.list.appendChild( el( 'h2', { class: 'hkr-s-time', text: group } ) );
				lastGroup = group;
			}
			self.list.appendChild( self.card( b ) );
		} );
		if ( this.highlight ) {
			var target = this.list.querySelector( '[data-id="' + this.highlight + '"]' );
			if ( target ) {
				target.scrollIntoView( { behavior: 'smooth', block: 'center' } );
				target.classList.add( 'is-highlight' );
			}
			this.highlight = 0;
		}
	};

	Staff.prototype.card = function ( b ) {
		var self = this;
		var open = !! this.state.open[ b.id ];
		var flags = [];
		if ( b.celebration ) {
			flags.push( el( 'span', { class: 'hkr-s-flag hkr-s-flag--party', text: '🎉 ' + b.celebration } ) );
		}
		if ( b.dietary ) {
			flags.push( el( 'span', { class: 'hkr-s-flag hkr-s-flag--warn', text: 'Allergy / dietary' } ) );
		}
		if ( b.highChair ) {
			flags.push( el( 'span', { class: 'hkr-s-flag', text: 'High chair' } ) );
		}
		if ( b.largeParty ) {
			flags.push( el( 'span', { class: 'hkr-s-flag hkr-s-flag--warn', text: 'Large party' } ) );
		}
		var actions = el( 'div', { class: 'hkr-s-actions' } );
		if ( this.cfg.canEdit ) {
			var add = function ( label, cls, fn ) {
				actions.appendChild( el( 'button', { type: 'button', class: 'hkr-s-btn ' + ( cls || '' ), onclick: fn }, [ label ] ) );
			};
			if ( b.status === 'pending' ) {
				add( '✓ Confirm', 'hkr-s-btn--ok', function () {
					self.setStatus( b, 'confirmed', '', true );
				} );
				add( 'Decline / suggest time', 'hkr-s-btn--ghost', function () {
					self.messageDialog( b, 'declined', 'Decline booking', 'Message to the guest (e.g. suggest another time)' );
				} );
			}
			if ( b.status === 'confirmed' ) {
				add( 'Seated', '', function () {
					self.setStatus( b, 'seated', '', false );
				} );
				add( 'No-show', 'hkr-s-btn--ghost', function () {
					self.setStatus( b, 'no_show', '', false );
				} );
			}
			if ( b.status === 'seated' ) {
				add( 'Completed', '', function () {
					self.setStatus( b, 'completed', '', false );
				} );
			}
			if ( b.status === 'pending' || b.status === 'confirmed' ) {
				add( 'Cancel', 'hkr-s-btn--ghost', function () {
					self.messageDialog( b, 'cancelled', 'Cancel booking', 'Message to the guest (optional)' );
				} );
			}
			if ( b.status === 'cancelled' || b.status === 'declined' || b.status === 'no_show' ) {
				add( 'Re-open', 'hkr-s-btn--ghost', function () {
					self.setStatus( b, 'pending', '', false );
				} );
			}
			add( 'Edit', 'hkr-s-btn--ghost', function () {
				self.editDialog( b );
			} );
			add( 'Note', 'hkr-s-btn--ghost', function () {
				self.noteDialog( b );
			} );
		}
		var details = el( 'dl', { class: 'hkr-s-details', hidden: ! open } );
		var rows = [
			[ 'Reference', b.ref ],
			[ 'Location', b.location ],
			[ 'Time', b.timeLabel + ' – ' + b.endLabel ],
			[ 'Email', b.email ],
			[ 'Source', this.cfg.sources[ b.source ] || b.source ],
			[ 'Celebration details', b.celebrationDetails ],
			[ 'Seating', b.seating ],
			[ 'Dietary / allergies', b.dietary ],
			[ 'Special requests', b.requests ],
			[ 'Internal notes', b.internalNotes ]
		];
		rows.forEach( function ( r ) {
			if ( r[ 1 ] ) {
				details.appendChild( el( 'dt', { text: r[ 0 ] } ) );
				details.appendChild( el( 'dd', { text: r[ 1 ] } ) );
			}
		} );
		var toggle = el( 'button', { type: 'button', class: 'hkr-s-more', 'aria-expanded': open ? 'true' : 'false', onclick: function () {
			var now = details.hidden;
			details.hidden = ! now;
			this.setAttribute( 'aria-expanded', now ? 'true' : 'false' );
			this.textContent = now ? 'Hide details' : 'Details';
			self.state.open[ b.id ] = now;
		} }, [ open ? 'Hide details' : 'Details' ] );

		return el( 'article', { class: 'hkr-s-card hkr-s-card--' + b.status, 'data-id': String( b.id ) }, [
			el( 'div', { class: 'hkr-s-card__main' }, [
				el( 'div', { class: 'hkr-s-card__who' }, [
					el( 'strong', { class: 'hkr-s-name', text: b.name } ),
					el( 'span', { class: 'hkr-s-party', text: b.party + ( b.party === 1 ? ' guest' : ' guests' ) } ),
					b.area ? el( 'span', { class: 'hkr-s-area', text: b.area } ) : null,
					this.locations.length > 1 && ! this.state.location ? el( 'span', { class: 'hkr-s-area', text: b.location } ) : null
				] ),
				el( 'span', { class: 'hkr-s-status hkr-s-status--' + b.status, text: b.statusLabel } )
			] ),
			el( 'div', { class: 'hkr-s-card__contact' }, [
				b.phone ? el( 'a', { class: 'hkr-s-phone', href: 'tel:' + b.phone, text: '📞 ' + b.phoneDisplay } ) : null,
				el( 'span', { class: 'hkr-s-ref', text: b.ref } )
			] ),
			flags.length ? el( 'div', { class: 'hkr-s-flags' }, flags ) : null,
			actions,
			toggle,
			details
		] );
	};

	Staff.prototype.setStatus = function ( b, status, message, notify ) {
		var self = this;
		return this.api( '/staff/bookings/' + b.id + '/status', { method: 'POST', body: { status: status, message: message, notify: notify } } ).then( function () {
			self.toast( b.name + ': ' + ( self.cfg.statuses[ status ] || status ) + ( notify ? ' · guest emailed' : '' ) );
			return self.load();
		} ).catch( function ( e ) {
			self.toast( e.message, true );
		} );
	};

	Staff.prototype.openDialog = function ( title, body, onSave, saveLabel ) {
		var self = this;
		var d = this.dialog;
		d.innerHTML = '';
		var err = el( 'p', { class: 'hkr-s-error', role: 'alert', hidden: true } );
		var save = el( 'button', { type: 'submit', class: 'hkr-s-btn' }, [ saveLabel || 'Save' ] );
		var form = el( 'form', { method: 'dialog', class: 'hkr-s-form' }, [
			el( 'h2', { text: title } ),
			body,
			err,
			el( 'div', { class: 'hkr-s-actions' }, [
				save,
				el( 'button', { type: 'button', class: 'hkr-s-btn hkr-s-btn--ghost', onclick: function () {
					d.close();
				} }, [ 'Close' ] )
			] )
		] );
		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			save.disabled = true;
			err.hidden = true;
			Promise.resolve( onSave() ).then( function () {
				d.close();
				self.load();
			} ).catch( function ( ex ) {
				err.textContent = ex.message;
				err.hidden = false;
				save.disabled = false;
			} );
		} );
		d.appendChild( form );
		if ( typeof d.showModal === 'function' ) {
			d.showModal();
		} else {
			d.setAttribute( 'open', '' );
		}
		var first = d.querySelector( 'input, select, textarea' );
		if ( first ) {
			first.focus();
		}
	};

	function labelled( text, input ) {
		return el( 'label', { class: 'hkr-s-field' }, [ el( 'span', { text: text } ), input ] );
	}

	Staff.prototype.messageDialog = function ( b, status, title, prompt ) {
		var self = this;
		var msg = el( 'textarea', { class: 'hkr-s-input', rows: '3' } );
		var notify = el( 'input', { type: 'checkbox', checked: true } );
		this.openDialog( title + ' – ' + b.name, el( 'div', {}, [
			labelled( prompt, msg ),
			el( 'label', { class: 'hkr-s-check' }, [ notify, ' Email the guest' ] )
		] ), function () {
			return self.api( '/staff/bookings/' + b.id + '/status', { method: 'POST', body: { status: status, message: msg.value, notify: notify.checked } } );
		}, title );
	};

	Staff.prototype.noteDialog = function ( b ) {
		var self = this;
		var note = el( 'textarea', { class: 'hkr-s-input', rows: '3', required: true } );
		this.openDialog( 'Add a note – ' + b.name, labelled( 'Only staff see notes', note ), function () {
			if ( ! note.value.trim() ) {
				throw new Error( 'Please write a note.' );
			}
			return self.api( '/staff/bookings/' + b.id + '/note', { method: 'POST', body: { note: note.value } } );
		}, 'Add note' );
	};

	Staff.prototype.editDialog = function ( b ) {
		var self = this;
		var isNew = ! b;
		var locs = this.locations;
		if ( ! locs.length ) {
			return;
		}
		var locSel = el( 'select', { class: 'hkr-s-input', disabled: ! isNew } );
		locs.forEach( function ( l ) {
			var o = el( 'option', { value: String( l.id ), text: l.name } );
			if ( ( b && b.locationId === l.id ) || ( ! b && self.state.location === l.id ) ) {
				o.selected = true;
			}
			locSel.appendChild( o );
		} );
		var areaSel = el( 'select', { class: 'hkr-s-input' } );
		var date = el( 'input', { type: 'date', class: 'hkr-s-input', required: true, value: b ? b.date : this.state.date } );
		var party = el( 'input', { type: 'number', min: '1', max: '500', class: 'hkr-s-input', required: true, value: String( b ? b.party : 2 ) } );
		var time = el( 'select', { class: 'hkr-s-input', required: true } );
		var name = el( 'input', { type: 'text', class: 'hkr-s-input', required: true, value: b ? b.name : '' } );
		var phone = el( 'input', { type: 'tel', class: 'hkr-s-input', value: b ? b.phoneDisplay : '' } );
		var email = el( 'input', { type: 'email', class: 'hkr-s-input', value: b ? b.email : '' } );
		var celebration = el( 'select', { class: 'hkr-s-input' } );
		[ [ '', 'None' ] ].concat( this.cfg.celebrations.map( function ( c ) {
			return [ c, c ];
		} ) ).concat( [ [ 'Other', 'Other' ] ] ).forEach( function ( o ) {
			celebration.appendChild( el( 'option', { value: o[ 0 ], text: o[ 1 ] } ) );
		} );
		var celebrationText = el( 'input', { type: 'text', class: 'hkr-s-input', placeholder: 'What are they celebrating?' } );
		if ( b && b.celebration ) {
			if ( this.cfg.celebrations.indexOf( b.celebration ) >= 0 ) {
				celebration.value = b.celebration;
			} else {
				celebration.value = 'Other';
				celebrationText.value = b.celebration;
			}
		}
		var dietary = el( 'textarea', { class: 'hkr-s-input', rows: '2' } );
		dietary.value = b ? b.dietary : '';
		var requests = el( 'textarea', { class: 'hkr-s-input', rows: '2' } );
		requests.value = b ? b.requests : '';
		var status = el( 'select', { class: 'hkr-s-input' }, [ el( 'option', { value: 'confirmed', text: 'Confirmed' } ), el( 'option', { value: 'pending', text: 'Pending' } ), el( 'option', { value: 'seated', text: 'Seated (walk-in)' } ) ] );
		var source = el( 'select', { class: 'hkr-s-input' }, [ el( 'option', { value: 'phone', text: 'Phone' } ), el( 'option', { value: 'walkin', text: 'Walk-in' } ), el( 'option', { value: 'staff', text: 'Staff' } ) ] );
		var notify = el( 'input', { type: 'checkbox', checked: isNew } );
		var slotHelp = el( 'small', { class: 'hkr-s-help' } );

		function fillAreas() {
			var loc = locs.filter( function ( l ) {
				return String( l.id ) === locSel.value;
			} )[ 0 ];
			areaSel.innerHTML = '';
			var areas = loc ? loc.areas.filter( function ( a ) {
				return a.active || ( b && b.areaId === a.id );
			} ) : [];
			if ( ! areas.length ) {
				areaSel.appendChild( el( 'option', { value: '0', text: '—' } ) );
			}
			areas.forEach( function ( a ) {
				var o = el( 'option', { value: String( a.id ), text: a.name } );
				if ( b && b.areaId === a.id ) {
					o.selected = true;
				}
				areaSel.appendChild( o );
			} );
		}
		function fillTimes() {
			var current = time.value || ( b ? b.time : '' );
			time.innerHTML = '';
			slotHelp.textContent = '…';
			var q = '?location=' + locSel.value + '&area=' + areaSel.value + '&date=' + date.value + '&party=' + ( parseInt( party.value, 10 ) || 1 ) + ( b ? '&exclude=' + b.id : '' );
			self.api( '/staff/slots' + q ).then( function ( data ) {
				slotHelp.textContent = data.slots.length ? '' : 'Closed on this day.';
				data.slots.forEach( function ( s ) {
					var label = s.label + ( s.left !== null ? ' (' + s.left + ' left)' : '' ) + ( s.available ? '' : ' – full' );
					var o = el( 'option', { value: s.time, text: label } );
					if ( s.time === current ) {
						o.selected = true;
					}
					time.appendChild( o );
				} );
			} ).catch( function ( e ) {
				slotHelp.textContent = e.message;
			} );
		}
		locSel.addEventListener( 'change', function () {
			fillAreas();
			fillTimes();
		} );
		[ areaSel, date, party ].forEach( function ( n ) {
			n.addEventListener( 'change', fillTimes );
		} );
		fillAreas();
		fillTimes();

		var body = el( 'div', { class: 'hkr-s-grid' }, [
			labelled( 'Location', locSel ),
			labelled( 'Booking type', areaSel ),
			labelled( 'Date', date ),
			labelled( 'Guests', party ),
			el( 'label', { class: 'hkr-s-field' }, [ el( 'span', { text: 'Time' } ), time, slotHelp ] ),
			isNew ? labelled( 'Status', status ) : null,
			isNew ? labelled( 'Source', source ) : null,
			labelled( 'Guest name', name ),
			labelled( 'Phone', phone ),
			labelled( 'Email', email ),
			labelled( 'Celebration', celebration ),
			labelled( 'Celebration (other)', celebrationText ),
			labelled( 'Dietary / allergies', dietary ),
			labelled( 'Special requests', requests ),
			el( 'label', { class: 'hkr-s-check hkr-s-field--wide' }, [ notify, isNew ? ' Email the guest a confirmation' : ' Email the guest about the change' ] )
		] );

		this.openDialog( isNew ? 'Add booking' : 'Edit ' + b.ref, body, function () {
			var payload = {
				area: parseInt( areaSel.value, 10 ) || 0,
				date: date.value,
				time: time.value,
				party: parseInt( party.value, 10 ) || 1,
				name: name.value,
				phone: phone.value,
				email: email.value,
				celebration: celebration.value,
				celebration_text: celebrationText.value,
				dietary: dietary.value,
				requests: requests.value,
				notify: notify.checked
			};
			if ( ! payload.time ) {
				throw new Error( 'Please choose a time.' );
			}
			if ( isNew ) {
				payload.location = parseInt( locSel.value, 10 );
				payload.status = status.value;
				payload.source = source.value;
				return self.api( '/staff/bookings', { method: 'POST', body: payload } );
			}
			return self.api( '/staff/bookings/' + b.id, { method: 'POST', body: payload } );
		}, isNew ? 'Add booking' : 'Save' );
	};

	Staff.prototype.startPolling = function () {
		var self = this;
		var every = Math.max( 10, this.cfg.pollSeconds || 30 ) * 1000;
		setInterval( function () {
			if ( document.hidden && ! self.sound ) {
				return;
			}
			self.api( '/staff/poll?since=' + self.state.latestId + '&location=' + self.state.location ).then( function ( data ) {
				self.setPending( data.pending );
				if ( data.new && data.new.length ) {
					self.state.latestId = data.latestId;
					var fresh = data.new.filter( function ( b ) {
						return b.source === 'web';
					} );
					if ( fresh.length ) {
						if ( self.sound ) {
							self.beep();
						}
						fresh.forEach( function ( b ) {
							self.toast( 'New booking: ' + b.name + ' · ' + b.party + ' guests · ' + b.dateLabel + ', ' + b.timeLabel + ' (tap to open)', false, function () {
								self.state.date = b.date;
								self.state.status = '';
								self.statusSelect.value = '';
								self.highlight = b.id;
								self.state.open[ b.id ] = true;
								self.load();
							} );
						} );
					}
					self.load();
				} else {
					self.state.latestId = Math.max( self.state.latestId, data.latestId || 0 );
				}
			} ).catch( function () {} );
		}, every );
	};

	function boot() {
		var nodes = document.querySelectorAll( '.hkr-staff[data-hkr-staff]' );
		Array.prototype.forEach.call( nodes, function ( node ) {
			if ( ! node.__hkr ) {
				node.__hkr = new Staff( node );
			}
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
