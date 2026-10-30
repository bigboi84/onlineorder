/* HAKKA Reservations – admin screens. */
( function ( $ ) {
	'use strict';

	var uid = Date.now();

	// Image pickers.
	$( document ).on( 'click', '.hkr-image-choose', function ( e ) {
		e.preventDefault();
		var wrap = $( this ).closest( '.hkr-image-field' );
		var frame = wp.media( { title: hkrAdmin.chooseImage, button: { text: hkrAdmin.useImage }, library: { type: 'image' }, multiple: false } );
		frame.on( 'select', function () {
			var att = frame.state().get( 'selection' ).first().toJSON();
			var url = att.sizes && att.sizes.medium ? att.sizes.medium.url : att.url;
			wrap.find( '.hkr-image-id' ).val( att.id );
			wrap.find( '.hkr-image-preview' ).html( $( '<img alt="">' ).attr( 'src', url ) );
			wrap.find( '.hkr-image-remove' ).prop( 'hidden', false );
		} );
		frame.open();
	} );
	$( document ).on( 'click', '.hkr-image-remove', function ( e ) {
		e.preventDefault();
		var wrap = $( this ).closest( '.hkr-image-field' );
		wrap.find( '.hkr-image-id' ).val( 0 );
		wrap.find( '.hkr-image-preview' ).empty();
		$( this ).prop( 'hidden', true );
	} );

	// Opening hours.
	function syncClosed( row ) {
		var closed = row.find( '.hkr-closed' ).is( ':checked' );
		row.toggleClass( 'is-closed', closed );
		row.find( '.hkr-ranges input' ).prop( 'disabled', closed );
	}
	$( '.hkr-hours tr' ).each( function () {
		syncClosed( $( this ) );
	} );
	$( document ).on( 'change', '.hkr-closed', function () {
		syncClosed( $( this ).closest( 'tr' ) );
	} );
	$( document ).on( 'click', '.hkr-add-range', function ( e ) {
		e.preventDefault();
		var name = $( this ).data( 'name' ) + '[' + ( uid++ ) + ']';
		var range = $( this ).siblings( '.hkr-range' ).last().clone();
		range.find( 'input' ).each( function ( i ) {
			$( this ).attr( 'name', name + '[' + i + ']' ).val( '' ).prop( 'disabled', false );
		} );
		$( this ).before( range );
	} );
	$( document ).on( 'click', '.hkr-remove-range', function ( e ) {
		e.preventDefault();
		var cell = $( this ).closest( '.hkr-ranges' );
		if ( cell.find( '.hkr-range' ).length > 1 ) {
			$( this ).closest( '.hkr-range' ).remove();
		} else {
			cell.closest( 'tr' ).find( '.hkr-closed' ).prop( 'checked', true ).trigger( 'change' );
		}
	} );
	function copyDay( from, toDays ) {
		var src = $( '.hkr-hours tr[data-day="' + from + '"]' );
		toDays.forEach( function ( d ) {
			var row = $( '.hkr-hours tr[data-day="' + d + '"]' );
			var cell = row.find( '.hkr-ranges' );
			cell.find( '.hkr-range' ).remove();
			src.find( '.hkr-range' ).each( function ( i ) {
				var clone = $( this ).clone();
				var srcInputs = $( this ).find( 'input' );
				clone.find( 'input' ).each( function ( j ) {
					$( this ).attr( 'name', 'hours[' + d + '][' + i + '][' + j + ']' ).val( srcInputs.eq( j ).val() );
				} );
				cell.find( '.hkr-add-range' ).before( clone );
			} );
			row.find( '.hkr-closed' ).prop( 'checked', src.find( '.hkr-closed' ).is( ':checked' ) );
			syncClosed( row );
		} );
	}
	$( '.hkr-copy-monday' ).on( 'click', function () {
		copyDay( 1, [ 2, 3, 4, 5 ] );
	} );
	$( '.hkr-copy-all' ).on( 'click', function () {
		copyDay( 1, [ 2, 3, 4, 5, 6, 7 ] );
	} );

	// Repeating rows (special dates, booking types).
	function addRow( templateId, tbody ) {
		var html = document.getElementById( templateId ).innerHTML.replace( /__i__/g, 'n' + ( uid++ ) );
		$( tbody ).append( html );
	}
	$( '.hkr-add-special' ).on( 'click', function () {
		addRow( 'hkr-special-template', '.hkr-special tbody' );
	} );
	$( '.hkr-add-area' ).on( 'click', function () {
		addRow( 'hkr-area-template', '.hkr-areas tbody' );
	} );
	$( document ).on( 'click', '.hkr-remove-row', function ( e ) {
		e.preventDefault();
		if ( window.confirm( hkrAdmin.removeConfirm ) ) {
			$( this ).closest( 'tr' ).remove();
		}
	} );

	// Booking add/edit screen: booking types and available times.
	var form = $( '.hkr-booking-form' );
	if ( form.length ) {
		var areas = form.data( 'areas' ) || {};
		var bookingId = parseInt( form.data( 'booking' ), 10 ) || 0;
		var loc = $( '#hkr-location' );
		var area = $( '#hkr-area' );
		var date = $( '#hkr-date' );
		var party = $( '#hkr-party' );
		var time = $( '#hkr-time' );
		var help = $( '.hkr-slot-help' );

		var fillAreas = function () {
			var current = String( area.val() || area.data( 'current' ) || '' );
			var list = areas[ loc.val() ] || [];
			area.empty();
			if ( ! list.length ) {
				area.append( $( '<option value="0">—</option>' ) );
			}
			list.forEach( function ( a ) {
				area.append( $( '<option>' ).val( a.id ).text( a.name ).prop( 'selected', String( a.id ) === current ) );
			} );
		};
		var fillTimes = function () {
			var current = time.val() || time.data( 'current' ) || '';
			help.text( '…' );
			$.ajax( {
				url: hkrAdmin.api + '/staff/slots',
				data: { location: loc.val(), area: area.val(), date: date.val(), party: party.val(), exclude: bookingId },
				beforeSend: function ( xhr ) {
					xhr.setRequestHeader( 'X-WP-Nonce', hkrAdmin.nonce );
				}
			} ).done( function ( data ) {
				time.empty();
				var slots = data.slots || [];
				help.text( slots.length ? '' : hkrAdmin.noSlots );
				if ( current && ! slots.some( function ( s ) {
					return s.time === current;
				} ) ) {
					time.append( $( '<option>' ).val( current ).text( current ) );
				}
				slots.forEach( function ( s ) {
					var label = s.label + ( s.left !== null ? ' (' + s.left + ' left)' : '' ) + ( s.available ? '' : ' – full' );
					time.append( $( '<option>' ).val( s.time ).text( label ).prop( 'selected', s.time === current ) );
				} );
			} ).fail( function () {
				help.text( '' );
			} );
		};
		loc.on( 'change', function () {
			fillAreas();
			fillTimes();
		} );
		area.add( date ).add( party ).on( 'change', fillTimes );
		fillAreas();
		fillTimes();
	}
} )( jQuery );
