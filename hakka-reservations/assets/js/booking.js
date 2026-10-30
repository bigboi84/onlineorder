/**
 * HAKKA Reservations – guest booking form.
 * Steps: location (tabs in the header) → booking type → guests → date → time → details → review.
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

	function fmt( str ) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var i = 0;
		return String( str ).replace( /%(\d+\$)?[sd]/g, function ( m, pos ) {
			var idx = pos ? parseInt( pos, 10 ) - 1 : i++;
			return args[ idx ] !== undefined ? args[ idx ] : '';
		} );
	}

	function getCookie( name ) {
		var m = document.cookie.match( new RegExp( '(?:^|; )' + name + '=([^;]*)' ) );
		return m ? decodeURIComponent( m[ 1 ] ) : '';
	}

	function setCookie( name, value ) {
		document.cookie = name + '=' + encodeURIComponent( value ) + '; path=/; max-age=31536000; SameSite=Lax';
	}

	function pad( n ) {
		return ( n < 10 ? '0' : '' ) + n;
	}

	function ymd( d ) {
		return d.getFullYear() + '-' + pad( d.getMonth() + 1 ) + '-' + pad( d.getDate() );
	}

	function parseYmd( s ) {
		var p = s.split( '-' );
		return new Date( +p[ 0 ], +p[ 1 ] - 1, +p[ 2 ] );
	}

	function prettyDate( s ) {
		try {
			return parseYmd( s ).toLocaleDateString( undefined, { weekday: 'long', day: 'numeric', month: 'long' } );
		} catch ( e ) {
			return s;
		}
	}

	function Booking( root ) {
		this.root = root;
		this.cfg = JSON.parse( root.getAttribute( 'data-hkr-config' ) );
		this.t = this.cfg.i18n;
		this.state = { loc: null, area: null, party: 2, date: '', time: '', timeLabel: '', details: {} };
		this.calendar = {};
		this.month = null;
		this.step = 'type';
		this.render();
	}

	Booking.prototype.api = function ( path, opts ) {
		opts = opts || {};
		var url = this.cfg.api.replace( /\/$/, '' ) + path;
		return fetch( url, {
			method: opts.method || 'GET',
			headers: opts.body ? { 'Content-Type': 'application/json' } : {},
			body: opts.body ? JSON.stringify( opts.body ) : undefined,
			credentials: 'same-origin'
		} ).then( function ( res ) {
			return res.json().catch( function () {
				return {};
			} ).then( function ( data ) {
				if ( ! res.ok ) {
					var err = new Error( ( data && data.message ) || 'Error' );
					err.status = res.status;
					err.code = data && data.code;
					throw err;
				}
				return data;
			} );
		} );
	};

	Booking.prototype.initialLocation = function () {
		var locs = this.cfg.locations;
		var params = new URLSearchParams( window.location.search );
		var wanted = this.cfg.preselect || params.get( 'loc' ) || getCookie( 'hkr_loc' );
		var found = null;
		locs.forEach( function ( l ) {
			if ( wanted && ( l.slug === wanted || String( l.id ) === wanted ) ) {
				found = l;
			}
		} );
		return found || ( locs.length === 1 ? locs[ 0 ] : null );
	};

	Booking.prototype.render = function () {
		var self = this;
		this.root.innerHTML = '';

		this.heroImgs = [ el( 'img', { class: 'hkr-hero__img is-active', alt: '', loading: 'lazy', decoding: 'async' } ), el( 'img', { class: 'hkr-hero__img', alt: '', loading: 'lazy', decoding: 'async' } ) ];
		this.heroInfo = el( 'div', { class: 'hkr-hero__info', 'aria-live': 'polite' } );
		var tabs = null;
		if ( this.cfg.locations.length > 1 ) {
			tabs = el( 'div', { class: 'hkr-tabs', role: 'group', 'aria-label': this.t.chooseLocation } );
			// Short tab labels when every location shares a first word ("HAKKA Port of Spain" → "Port of Spain").
			var firstWords = this.cfg.locations.map( function ( l ) {
				return l.name.split( ' ' )[ 0 ];
			} );
			var shared = firstWords.every( function ( w ) {
				return w === firstWords[ 0 ];
			} ) && this.cfg.locations.every( function ( l ) {
				return l.name.indexOf( ' ' ) > 0;
			} );
			this.cfg.locations.forEach( function ( l ) {
				tabs.appendChild( el( 'button', {
					type: 'button',
					class: 'hkr-tab',
					'data-id': l.id,
					'aria-pressed': 'false',
					'aria-label': l.name,
					onclick: function () {
						self.selectLocation( l );
					}
				}, [ shared ? l.name.slice( l.name.indexOf( ' ' ) + 1 ) : l.name ] ) );
			} );
		}
		this.hero = el( 'div', { class: 'hkr-hero' }, [
			el( 'div', { class: 'hkr-hero__media' }, this.heroImgs ),
			el( 'div', { class: 'hkr-hero__shade' } ),
			el( 'div', { class: 'hkr-hero__content' }, [ tabs, this.heroInfo ] )
		] );
		this.chips = el( 'div', { class: 'hkr-chips', 'aria-live': 'polite' } );
		this.body = el( 'div', { class: 'hkr-body' } );
		this.root.appendChild( this.hero );
		this.root.appendChild( el( 'div', { class: 'hkr-card' }, [ this.chips, this.body ] ) );

		var initial = this.initialLocation();
		if ( initial ) {
			this.selectLocation( initial, true );
		} else {
			this.showHero( null );
			this.body.appendChild( el( 'div', { class: 'hkr-step' }, [
				el( 'h2', { class: 'hkr-title', text: this.t.chooseLocation, tabindex: '-1' } ),
				el( 'div', { class: 'hkr-options hkr-options--locations' }, this.cfg.locations.map( function ( l ) {
					return el( 'button', { type: 'button', class: 'hkr-option', onclick: function () {
						self.selectLocation( l );
					} }, [ el( 'strong', { text: l.name } ), el( 'span', { text: l.address } ) ] );
				} ) )
			] ) );
		}
	};

	Booking.prototype.showHero = function ( loc ) {
		var src = ( loc && loc.image ) || this.cfg.defaultImage || '';
		var current = this.heroImgs[ 0 ].classList.contains( 'is-active' ) ? 0 : 1;
		var next = 1 - current;
		var nextImg = this.heroImgs[ next ];
		var curImg = this.heroImgs[ current ];
		this.hero.classList.toggle( 'hkr-hero--noimage', ! src );
		if ( src && curImg.getAttribute( 'src' ) !== src ) {
			nextImg.onload = function () {
				nextImg.classList.add( 'is-active' );
				curImg.classList.remove( 'is-active' );
			};
			nextImg.alt = loc ? loc.imageAlt : '';
			nextImg.src = src;
			if ( nextImg.complete ) {
				nextImg.onload();
			}
		}
		this.heroInfo.innerHTML = '';
		if ( loc ) {
			var lines = [ el( 'h2', { class: 'hkr-hero__name', text: loc.name } ) ];
			if ( loc.address ) {
				lines.push( el( 'p', { class: 'hkr-hero__line', text: loc.address } ) );
			}
			var links = el( 'p', { class: 'hkr-hero__links' } );
			if ( loc.phone ) {
				links.appendChild( el( 'a', { href: 'tel:' + loc.phoneRaw, text: loc.phone } ) );
			}
			if ( loc.mapUrl ) {
				links.appendChild( el( 'a', { href: loc.mapUrl, target: '_blank', rel: 'noopener', text: this.t.directions } ) );
			}
			lines.push( links );
			if ( loc.hours && loc.hours.length ) {
				lines.push( el( 'p', { class: 'hkr-hero__hours', text: loc.hours.join( ' · ' ) } ) );
			}
			lines.forEach( function ( n ) {
				this.heroInfo.appendChild( n );
			}, this );
		}
		var tabs = this.root.querySelectorAll( '.hkr-tab' );
		Array.prototype.forEach.call( tabs, function ( tab ) {
			var on = loc && String( loc.id ) === tab.getAttribute( 'data-id' );
			tab.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
			tab.classList.toggle( 'is-active', !! on );
		} );
	};

	Booking.prototype.selectLocation = function ( loc, initial ) {
		this.state.loc = loc;
		this.state.area = null;
		this.state.date = '';
		this.state.time = '';
		this.calendar = {};
		this.month = null;
		this.state.party = Math.max( loc.minParty, Math.min( this.state.party, loc.maxParty ) );
		setCookie( 'hkr_loc', loc.slug );
		this.showHero( loc );
		if ( loc.areas.length === 1 ) {
			this.state.area = loc.areas[ 0 ];
		}
		this.go( loc.areas.length > 1 ? 'type' : 'party', initial );
	};

	Booking.prototype.limits = function () {
		var loc = this.state.loc;
		var area = this.state.area;
		var min = loc.minParty;
		var max = loc.maxParty;
		if ( area ) {
			min = Math.max( min, area.minParty || 1 );
			if ( area.maxParty ) {
				max = area.maxParty;
			}
		}
		return [ min, Math.max( min, max ) ];
	};

	Booking.prototype.renderChips = function () {
		var self = this;
		var s = this.state;
		this.chips.innerHTML = '';
		var items = [];
		if ( s.area && s.loc.areas.length > 1 ) {
			items.push( [ 'type', s.area.name ] );
		}
		if ( this.order().indexOf( this.step ) > this.order().indexOf( 'party' ) ) {
			items.push( [ 'party', s.party + ' ' + ( s.party === 1 ? this.t.guest : this.t.guests ) ] );
		}
		if ( s.date ) {
			items.push( [ 'date', prettyDate( s.date ) ] );
		}
		if ( s.time ) {
			items.push( [ 'time', s.timeLabel ] );
		}
		items.forEach( function ( item ) {
			self.chips.appendChild( el( 'button', { type: 'button', class: 'hkr-chip', title: self.t.change, onclick: function () {
				self.go( item[ 0 ] );
			} }, [ item[ 1 ] ] ) );
		} );
	};

	Booking.prototype.order = function () {
		var steps = [];
		if ( this.state.loc && this.state.loc.areas.length > 1 ) {
			steps.push( 'type' );
		}
		return steps.concat( [ 'party', 'date', 'time', 'details', 'review' ] );
	};

	Booking.prototype.go = function ( step, noFocus ) {
		this.step = step;
		this.body.innerHTML = '';
		this.renderChips();
		var view = this[ 'view_' + step ]();
		var order = this.order();
		var progress = el( 'p', { class: 'hkr-progress', text: fmt( this.t.step, order.indexOf( step ) + 1, order.length ) } );
		this.body.appendChild( progress );
		this.body.appendChild( view );
		if ( ! noFocus ) {
			var h = view.querySelector( '.hkr-title' );
			if ( h ) {
				h.focus( { preventScroll: true } );
				var top = this.root.getBoundingClientRect().top + window.pageYOffset - 80;
				if ( this.root.getBoundingClientRect().top < 0 ) {
					window.scrollTo( { top: top, behavior: 'smooth' } );
				}
			}
		}
	};

	Booking.prototype.nav = function ( prev, next ) {
		var bar = el( 'div', { class: 'hkr-actions' } );
		if ( prev ) {
			bar.appendChild( el( 'button', { type: 'button', class: 'hkr-btn hkr-btn--ghost', onclick: prev }, [ this.t.back ] ) );
		}
		if ( next ) {
			bar.appendChild( next );
		}
		return bar;
	};

	Booking.prototype.prevOf = function ( step ) {
		var order = this.order();
		var i = order.indexOf( step );
		var self = this;
		return i > 0 ? function () {
			self.go( order[ i - 1 ] );
		} : null;
	};

	Booking.prototype.view_type = function () {
		var self = this;
		var loc = this.state.loc;
		return el( 'div', { class: 'hkr-step' }, [
			el( 'h2', { class: 'hkr-title', tabindex: '-1', text: this.t.chooseType } ),
			el( 'div', { class: 'hkr-options' }, loc.areas.map( function ( a ) {
				var on = self.state.area && self.state.area.id === a.id;
				return el( 'button', {
					type: 'button',
					class: 'hkr-option' + ( on ? ' is-active' : '' ),
					'aria-pressed': on ? 'true' : 'false',
					onclick: function () {
						if ( ! self.state.area || self.state.area.id !== a.id ) {
							self.state.area = a;
							self.state.date = '';
							self.state.time = '';
							self.calendar = {};
							var lim = self.limits();
							self.state.party = Math.max( lim[ 0 ], Math.min( self.state.party, lim[ 1 ] ) );
						}
						self.go( 'party' );
					}
				}, [ el( 'strong', { text: a.name } ), a.description ? el( 'span', { text: a.description } ) : null ] );
			} ) )
		] );
	};

	Booking.prototype.view_party = function () {
		var self = this;
		var lim = this.limits();
		var value = el( 'output', { class: 'hkr-stepper__value', 'aria-live': 'polite' } );
		var minus = el( 'button', { type: 'button', class: 'hkr-stepper__btn', 'aria-label': '−' }, [ '−' ] );
		var plus = el( 'button', { type: 'button', class: 'hkr-stepper__btn', 'aria-label': '+' }, [ '+' ] );
		function update() {
			value.textContent = self.state.party + ' ' + ( self.state.party === 1 ? self.t.guest : self.t.guests );
			minus.disabled = self.state.party <= lim[ 0 ];
			plus.disabled = self.state.party >= lim[ 1 ];
		}
		minus.addEventListener( 'click', function () {
			self.state.party = Math.max( lim[ 0 ], self.state.party - 1 );
			self.state.time = '';
			update();
		} );
		plus.addEventListener( 'click', function () {
			self.state.party = Math.min( lim[ 1 ], self.state.party + 1 );
			self.state.time = '';
			update();
		} );
		this.state.party = Math.max( lim[ 0 ], Math.min( this.state.party, lim[ 1 ] ) );
		update();
		var loc = this.state.loc;
		var groupText = String( this.t.largeGroup ).split( '%2$s' );
		return el( 'div', { class: 'hkr-step' }, [
			el( 'h2', { class: 'hkr-title', tabindex: '-1', text: this.t.partySize } ),
			el( 'div', { class: 'hkr-stepper' }, [ minus, value, plus ] ),
			loc.phone ? el( 'p', { class: 'hkr-help' }, [
				fmt( groupText[ 0 ], lim[ 1 ] ),
				el( 'a', { href: 'tel:' + loc.phoneRaw, text: loc.phone } ),
				groupText[ 1 ] || ''
			] ) : null,
			this.nav( this.prevOf( 'party' ), el( 'button', { type: 'button', class: 'hkr-btn', onclick: function () {
				self.go( 'date' );
			} }, [ this.t.next ] ) )
		] );
	};

	Booking.prototype.loadCalendar = function () {
		var key = this.state.loc.id + ':' + ( this.state.area ? this.state.area.id : 0 );
		if ( this.calendar[ key ] ) {
			return Promise.resolve( this.calendar[ key ] );
		}
		var self = this;
		var q = '?location=' + this.state.loc.id + ( this.state.area ? '&area=' + this.state.area.id : '' );
		return this.api( '/calendar' + q ).then( function ( data ) {
			self.calendar[ key ] = data.dates || {};
			return self.calendar[ key ];
		} );
	};

	Booking.prototype.view_date = function () {
		var self = this;
		var wrap = el( 'div', { class: 'hkr-step' }, [ el( 'h2', { class: 'hkr-title', tabindex: '-1', text: this.t.chooseDate } ) ] );
		var cal = el( 'div', { class: 'hkr-calendar', 'aria-busy': 'true' }, [ el( 'div', { class: 'hkr-loading', text: '…' } ) ] );
		wrap.appendChild( cal );
		wrap.appendChild( this.nav( this.prevOf( 'date' ), null ) );
		this.loadCalendar().then( function ( dates ) {
			self.drawMonth( cal, dates );
		} ).catch( function ( e ) {
			cal.innerHTML = '';
			cal.appendChild( el( 'p', { class: 'hkr-error', text: e.message || self.t.error } ) );
		} );
		return wrap;
	};

	Booking.prototype.drawMonth = function ( cal, dates ) {
		var self = this;
		var keys = Object.keys( dates ).sort();
		if ( ! keys.length ) {
			cal.innerHTML = '';
			cal.appendChild( el( 'p', { class: 'hkr-error', text: this.t.noSlots } ) );
			return;
		}
		var first = parseYmd( keys[ 0 ] );
		var last = parseYmd( keys[ keys.length - 1 ] );
		if ( ! this.month ) {
			var firstOpen = keys.filter( function ( k ) {
				return dates[ k ];
			} )[ 0 ];
			var start = this.state.date ? parseYmd( this.state.date ) : ( firstOpen ? parseYmd( firstOpen ) : first );
			this.month = new Date( start.getFullYear(), start.getMonth(), 1 );
		}
		var m = this.month;
		cal.innerHTML = '';
		cal.setAttribute( 'aria-busy', 'false' );
		var monthLabel = m.toLocaleDateString( undefined, { month: 'long', year: 'numeric' } );
		var canPrev = new Date( m.getFullYear(), m.getMonth(), 1 ) > new Date( first.getFullYear(), first.getMonth(), 1 );
		var canNext = new Date( m.getFullYear(), m.getMonth() + 1, 1 ) <= last;
		cal.appendChild( el( 'div', { class: 'hkr-cal__head' }, [
			el( 'button', { type: 'button', class: 'hkr-cal__nav', 'aria-label': this.t.prevMonth, disabled: ! canPrev, onclick: function () {
				self.month = new Date( m.getFullYear(), m.getMonth() - 1, 1 );
				self.drawMonth( cal, dates );
			} }, [ '‹' ] ),
			el( 'strong', { class: 'hkr-cal__month', text: monthLabel, 'aria-live': 'polite' } ),
			el( 'button', { type: 'button', class: 'hkr-cal__nav', 'aria-label': this.t.nextMonth, disabled: ! canNext, onclick: function () {
				self.month = new Date( m.getFullYear(), m.getMonth() + 1, 1 );
				self.drawMonth( cal, dates );
			} }, [ '›' ] )
		] ) );
		var grid = el( 'div', { class: 'hkr-cal__grid', role: 'grid' } );
		this.t.weekdays.forEach( function ( w ) {
			grid.appendChild( el( 'span', { class: 'hkr-cal__dow', 'aria-hidden': 'true', text: w } ) );
		} );
		var offset = ( m.getDay() + 6 ) % 7; // Monday first.
		for ( var i = 0; i < offset; i++ ) {
			grid.appendChild( el( 'span', { class: 'hkr-cal__blank' } ) );
		}
		var daysInMonth = new Date( m.getFullYear(), m.getMonth() + 1, 0 ).getDate();
		for ( var d = 1; d <= daysInMonth; d++ ) {
			( function ( day ) {
				var key = ymd( new Date( m.getFullYear(), m.getMonth(), day ) );
				var open = dates[ key ] === true;
				var outside = ! ( key in dates ); // Before today or past the booking window.
				var selected = self.state.date === key;
				grid.appendChild( el( 'button', {
					type: 'button',
					class: 'hkr-cal__day' + ( selected ? ' is-active' : '' ) + ( open ? '' : ( outside ? ' is-outside' : ' is-closed' ) ),
					disabled: ! open,
					'aria-pressed': selected ? 'true' : 'false',
					'aria-label': prettyDate( key ) + ( open ? '' : ' – ' + self.t.closed ),
					onclick: function () {
						self.state.date = key;
						self.state.time = '';
						self.go( 'time' );
					}
				}, [ String( day ) ] ) );
			} )( d );
		}
		cal.appendChild( grid );
	};

	Booking.prototype.view_time = function () {
		var self = this;
		var s = this.state;
		var wrap = el( 'div', { class: 'hkr-step' }, [ el( 'h2', { class: 'hkr-title', tabindex: '-1', text: this.t.chooseTime } ) ] );
		var list = el( 'div', { class: 'hkr-slots', 'aria-busy': 'true' }, [ el( 'div', { class: 'hkr-loading', text: '…' } ) ] );
		var msg = el( 'p', { class: 'hkr-error', role: 'alert', hidden: true } );
		wrap.appendChild( msg );
		wrap.appendChild( list );
		wrap.appendChild( this.nav( this.prevOf( 'time' ), null ) );
		if ( this.pendingError ) {
			msg.textContent = this.pendingError;
			msg.hidden = false;
			this.pendingError = '';
		}
		var q = '?location=' + s.loc.id + '&date=' + s.date + '&party=' + s.party + ( s.area ? '&area=' + s.area.id : '' );
		this.api( '/slots' + q ).then( function ( data ) {
			list.innerHTML = '';
			list.setAttribute( 'aria-busy', 'false' );
			if ( data.note ) {
				wrap.insertBefore( el( 'p', { class: 'hkr-help', text: data.note } ), list );
			}
			var any = false;
			( data.slots || [] ).forEach( function ( slot ) {
				any = any || slot.available;
				var extra = '';
				if ( ! slot.available ) {
					extra = self.t.full;
				} else if ( slot.left !== null && slot.left !== undefined && slot.left <= 10 ) {
					extra = fmt( self.t.spotsLeft, slot.left );
				}
				list.appendChild( el( 'button', {
					type: 'button',
					class: 'hkr-slot' + ( s.time === slot.time ? ' is-active' : '' ),
					disabled: ! slot.available,
					'aria-pressed': s.time === slot.time ? 'true' : 'false',
					onclick: function () {
						s.time = slot.time;
						s.timeLabel = slot.label;
						self.go( 'details' );
					}
				}, [ el( 'span', { class: 'hkr-slot__time', text: slot.label } ), extra ? el( 'span', { class: 'hkr-slot__left', text: extra } ) : null ] ) );
			} );
			if ( ! any ) {
				list.appendChild( el( 'p', { class: 'hkr-help', text: self.t.noSlots } ) );
			}
		} ).catch( function ( e ) {
			list.innerHTML = '';
			msg.textContent = e.message || self.t.error;
			msg.hidden = false;
		} );
		return wrap;
	};

	Booking.prototype.field = function ( opts ) {
		var d = this.state.details;
		var id = 'hkr-f-' + opts.name + '-' + Math.random().toString( 36 ).slice( 2, 7 );
		var label = el( 'label', { class: 'hkr-label', for: id }, [ opts.label, opts.optional ? el( 'span', { class: 'hkr-optional', text: ' (' + this.t.optional + ')' } ) : null ] );
		var input;
		if ( opts.type === 'textarea' ) {
			input = el( 'textarea', { id: id, name: opts.name, class: 'hkr-input', rows: '3', maxlength: opts.max || '1000', required: !! opts.required } );
			input.value = d[ opts.name ] || '';
		} else if ( opts.type === 'select' ) {
			input = el( 'select', { id: id, name: opts.name, class: 'hkr-input', required: !! opts.required } );
			opts.options.forEach( function ( o ) {
				var opt = el( 'option', { value: o[ 0 ], text: o[ 1 ] } );
				if ( ( d[ opts.name ] || '' ) === o[ 0 ] ) {
					opt.selected = true;
				}
				input.appendChild( opt );
			} );
		} else {
			input = el( 'input', { id: id, name: opts.name, type: opts.type || 'text', class: 'hkr-input', autocomplete: opts.autocomplete || null, required: !! opts.required, maxlength: opts.max || null, inputmode: opts.inputmode || null } );
			input.value = d[ opts.name ] || '';
		}
		var help = opts.help ? el( 'p', { class: 'hkr-help', id: id + '-help', text: opts.help } ) : null;
		if ( help ) {
			input.setAttribute( 'aria-describedby', id + '-help' );
		}
		return { wrap: el( 'div', { class: 'hkr-field' + ( opts.wide ? ' hkr-field--wide' : '' ) }, [ label, input, help ] ), input: input };
	};

	Booking.prototype.askCelebration = function () {
		var s = this.state;
		if ( s.area ) {
			return !! s.area.askCelebration;
		}
		return true;
	};

	Booking.prototype.view_details = function () {
		var self = this;
		var t = this.t;
		var cfg = this.cfg;
		var d = this.state.details;
		var form = el( 'form', { class: 'hkr-step hkr-form', novalidate: true } );
		form.appendChild( el( 'h2', { class: 'hkr-title', tabindex: '-1', text: t.yourDetails } ) );
		var grid = el( 'div', { class: 'hkr-grid' } );
		var fields = {};
		fields.name = this.field( { name: 'name', label: t.name, required: true, autocomplete: 'name', max: 120 } );
		fields.phone = this.field( { name: 'phone', label: t.phone, type: 'tel', required: true, autocomplete: 'tel', inputmode: 'tel', help: t.phoneHelp, max: 30 } );
		fields.email = this.field( { name: 'email', label: t.email, type: 'email', required: true, autocomplete: 'email', max: 190, wide: true } );
		[ 'name', 'phone', 'email' ].forEach( function ( k ) {
			grid.appendChild( fields[ k ].wrap );
		} );

		if ( this.askCelebration() ) {
			var opts = [ [ '', t.none ] ].concat( cfg.celebrations.map( function ( c ) {
				return [ c, c ];
			} ) ).concat( [ [ 'Other', t.other ] ] );
			fields.celebration = this.field( { name: 'celebration', label: t.celebrating, type: 'select', options: opts, wide: true } );
			fields.celebration_text = this.field( { name: 'celebration_text', label: t.celebratingWhat, max: 120, wide: true } );
			fields.celebration_details = this.field( { name: 'celebration_details', label: t.celebrationNote, type: 'textarea', max: 500, wide: true } );
			grid.appendChild( fields.celebration.wrap );
			grid.appendChild( fields.celebration_text.wrap );
			grid.appendChild( fields.celebration_details.wrap );
			var toggle = function () {
				var v = fields.celebration.input.value;
				fields.celebration_text.wrap.hidden = v !== 'Other';
				fields.celebration_text.input.required = v === 'Other';
				fields.celebration_details.wrap.hidden = v === '';
			};
			fields.celebration.input.addEventListener( 'change', toggle );
			toggle();
		}

		if ( cfg.seating ) {
			fields.seating = this.field( { name: 'seating', label: t.seating, type: 'select', required: cfg.seating.required, optional: ! cfg.seating.required, options: [ [ '', '—' ] ].concat( cfg.seating.options.map( function ( o ) {
				return [ o, o ];
			} ) ) } );
			grid.appendChild( fields.seating.wrap );
		}
		[ [ 'dietary', t.dietary, cfg.fields.dietary ], [ 'requests', t.requests, cfg.fields.requests ] ].forEach( function ( f ) {
			if ( f[ 2 ] === 'off' ) {
				return;
			}
			fields[ f[ 0 ] ] = self.field( { name: f[ 0 ], label: f[ 1 ], type: 'textarea', required: f[ 2 ] === 'required', optional: f[ 2 ] !== 'required', wide: true } );
			grid.appendChild( fields[ f[ 0 ] ].wrap );
		} );
		if ( cfg.fields.highChair !== 'off' ) {
			var hc = el( 'input', { type: 'checkbox', name: 'high_chair', id: 'hkr-hc' } );
			hc.checked = !! d.high_chair;
			fields.high_chair = { input: hc };
			grid.appendChild( el( 'div', { class: 'hkr-field hkr-field--wide hkr-check' }, [ hc, el( 'label', { for: 'hkr-hc', text: t.highChair } ) ] ) );
		}
		form.appendChild( grid );

		// Honeypot: hidden from people, bots fill it in.
		var hp = el( 'input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' } );
		form.appendChild( el( 'div', { class: 'hkr-hp', 'aria-hidden': 'true' }, [ el( 'label', { text: 'Website' } ), hp ] ) );

		var err = el( 'p', { class: 'hkr-error', role: 'alert', hidden: true } );
		form.appendChild( err );
		form.appendChild( this.nav( this.prevOf( 'details' ), el( 'button', { type: 'submit', class: 'hkr-btn' }, [ t.next ] ) ) );

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			var bad = null;
			Object.keys( fields ).forEach( function ( k ) {
				var input = fields[ k ].input;
				input.removeAttribute( 'aria-invalid' );
				var value = input.type === 'checkbox' ? input.checked : input.value.trim();
				if ( input.required && ! value && ! ( fields[ k ].wrap && fields[ k ].wrap.hidden ) ) {
					bad = bad || [ input, t.required ];
					input.setAttribute( 'aria-invalid', 'true' );
				}
				if ( k === 'email' && value && ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( value ) ) {
					bad = bad || [ input, t.invalidEmail ];
					input.setAttribute( 'aria-invalid', 'true' );
				}
				d[ k ] = value;
			} );
			d.website = hp.value;
			if ( bad ) {
				err.textContent = bad[ 1 ];
				err.hidden = false;
				bad[ 0 ].focus();
				return;
			}
			self.go( 'review' );
		} );
		return form;
	};

	Booking.prototype.view_review = function () {
		var self = this;
		var t = this.t;
		var s = this.state;
		var d = s.details;
		var rows = [ [ t.location, s.loc.name ] ];
		if ( s.area ) {
			rows.push( [ t.type, s.area.name ] );
		}
		rows.push( [ t.date, prettyDate( s.date ) ], [ t.time, s.timeLabel ], [ t.party, s.party + ' ' + ( s.party === 1 ? t.guest : t.guests ) ], [ t.name, d.name ], [ t.phone, d.phone ], [ t.email, d.email ] );
		var celebration = d.celebration === 'Other' ? d.celebration_text : d.celebration;
		if ( celebration ) {
			rows.push( [ t.celebration, celebration ] );
		}
		if ( d.dietary ) {
			rows.push( [ t.dietary, d.dietary ] );
		}
		if ( d.requests ) {
			rows.push( [ t.requests, d.requests ] );
		}
		if ( d.high_chair ) {
			rows.push( [ t.highChair, '✓' ] );
		}
		var dl = el( 'dl', { class: 'hkr-summary' } );
		rows.forEach( function ( r ) {
			dl.appendChild( el( 'dt', { text: r[ 0 ] } ) );
			dl.appendChild( el( 'dd', { text: r[ 1 ] } ) );
		} );

		var terms = el( 'input', { type: 'checkbox', id: 'hkr-terms', required: true } );
		var termsBox = el( 'div', { class: 'hkr-terms' }, [
			this.cfg.terms ? el( 'p', { class: 'hkr-help', text: this.cfg.terms } ) : null,
			el( 'div', { class: 'hkr-check' }, [ terms, el( 'label', { for: 'hkr-terms' }, [ t.terms, this.cfg.termsUrl ? ' · ' : '', this.cfg.termsUrl ? el( 'a', { href: this.cfg.termsUrl, target: '_blank', rel: 'noopener', text: t.readTerms } ) : null ] ) ] )
		] );
		var turnstile = null;
		if ( this.cfg.turnstileSite ) {
			turnstile = el( 'div', { class: 'hkr-turnstile' } );
			setTimeout( function () {
				if ( window.turnstile ) {
					self.turnstileId = window.turnstile.render( turnstile, { sitekey: self.cfg.turnstileSite } );
				}
			}, 50 );
		}
		var err = el( 'p', { class: 'hkr-error', role: 'alert', hidden: true } );
		var submit = el( 'button', { type: 'button', class: 'hkr-btn' }, [ t.submit ] );
		submit.addEventListener( 'click', function () {
			if ( ! terms.checked ) {
				err.textContent = t.terms;
				err.hidden = false;
				terms.focus();
				return;
			}
			submit.disabled = true;
			submit.textContent = t.sending;
			err.hidden = true;
			var body = {
				location: s.loc.id,
				area: s.area ? s.area.id : 0,
				date: s.date,
				time: s.time,
				party: s.party,
				name: d.name,
				phone: d.phone,
				email: d.email,
				celebration: d.celebration || '',
				celebration_text: d.celebration_text || '',
				celebration_details: d.celebration ? ( d.celebration_details || '' ) : '',
				seating: d.seating || '',
				high_chair: !! d.high_chair,
				dietary: d.dietary || '',
				requests: d.requests || '',
				terms: true,
				website: d.website || ''
			};
			if ( self.cfg.turnstileSite && window.turnstile && self.turnstileId !== undefined ) {
				body.turnstile = window.turnstile.getResponse( self.turnstileId ) || '';
			}
			self.api( '/bookings', { method: 'POST', body: body } ).then( function ( res ) {
				self.done( res );
			} ).catch( function ( e ) {
				submit.disabled = false;
				submit.textContent = t.submit;
				if ( e.code === 'hkr_full' || e.code === 'hkr_time' || e.code === 'hkr_window' ) {
					self.pendingError = e.message;
					s.time = '';
					self.go( 'time' );
					return;
				}
				err.textContent = e.message || t.error;
				err.hidden = false;
				if ( window.turnstile && self.turnstileId !== undefined ) {
					window.turnstile.reset( self.turnstileId );
				}
			} );
		} );
		return el( 'div', { class: 'hkr-step' }, [
			el( 'h2', { class: 'hkr-title', tabindex: '-1', text: t.review } ),
			dl,
			el( 'p', { class: 'hkr-confirm-note', text: s.loc.confirmNote } ),
			termsBox,
			turnstile,
			err,
			this.nav( this.prevOf( 'review' ), submit )
		] );
	};

	Booking.prototype.done = function ( res ) {
		var self = this;
		var t = this.t;
		this.chips.innerHTML = '';
		this.body.innerHTML = '';
		var title = el( 'h2', { class: 'hkr-title', tabindex: '-1', text: t.thanksTitle } );
		this.body.appendChild( el( 'div', { class: 'hkr-step hkr-done', role: 'status' }, [
			el( 'div', { class: 'hkr-done__icon', 'aria-hidden': 'true', text: '✓' } ),
			title,
			el( 'p', { class: 'hkr-done__note', text: res.confirmNote } ),
			el( 'dl', { class: 'hkr-summary' }, [
				el( 'dt', { text: t.location } ), el( 'dd', { text: res.location } ),
				res.area ? el( 'dt', { text: t.type } ) : null, res.area ? el( 'dd', { text: res.area } ) : null,
				el( 'dt', { text: t.date } ), el( 'dd', { text: res.date } ),
				el( 'dt', { text: t.time } ), el( 'dd', { text: res.time } ),
				el( 'dt', { text: t.party } ), el( 'dd', { text: String( res.party ) } )
			] ),
			el( 'p', { text: fmt( t.thanksRef, res.ref ) } ),
			el( 'p', { class: 'hkr-help', text: fmt( t.thanksEmail, res.email ) } ),
			el( 'div', { class: 'hkr-actions' }, [ el( 'button', { type: 'button', class: 'hkr-btn hkr-btn--ghost', onclick: function () {
				self.state.details = {};
				self.state.date = '';
				self.state.time = '';
				self.go( self.order()[ 0 ] );
			} }, [ t.bookAnother ] ) ] )
		] ) );
		title.focus();
	};

	function boot() {
		var nodes = document.querySelectorAll( '.hkr-booking[data-hkr-config]' );
		Array.prototype.forEach.call( nodes, function ( node ) {
			if ( ! node.__hkr ) {
				node.__hkr = new Booking( node );
			}
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
