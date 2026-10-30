<?php
/**
 * Shortcodes: [hakka_booking], [hakka_manage_booking], [hakka_staff_bookings].
 *
 * @package HakkaReservations
 */

defined( 'ABSPATH' ) || exit;

class HKR_Frontend {

	public static function init() {
		add_shortcode( 'hakka_booking', array( __CLASS__, 'booking_form' ) );
		add_shortcode( 'hakka_manage_booking', array( __CLASS__, 'manage_page' ) );
		add_shortcode( 'hakka_staff_bookings', array( __CLASS__, 'staff_screen' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'register_assets' ) );
		add_action( 'template_redirect', array( __CLASS__, 'private_pages' ) );
		add_filter( 'wp_robots', array( __CLASS__, 'robots' ) );
		add_filter( 'rank_math/frontend/robots', array( __CLASS__, 'rank_math_robots' ) );
		add_filter( 'rank_math/sitemap/posts_to_exclude', array( __CLASS__, 'rank_math_exclude' ) );
		add_filter( 'wp_sitemaps_posts_query_args', array( __CLASS__, 'core_sitemap_exclude' ), 10, 2 );
	}

	/**
	 * Pages search engines should skip: the staff screen, the manage page and the test page.
	 */
	public static function private_page_ids() {
		return array_filter(
			array(
				(int) HKR_Settings::get( 'staff_page_id' ),
				(int) HKR_Settings::get( 'manage_page_id' ),
				(int) HKR_Settings::get( 'test_page_id' ),
			)
		);
	}

	private static function is_private_page() {
		return is_page() && in_array( (int) get_queried_object_id(), self::private_page_ids(), true );
	}

	public static function private_pages() {
		$id = (int) get_queried_object_id();
		if ( is_page() && in_array( $id, array( (int) HKR_Settings::get( 'staff_page_id' ), (int) HKR_Settings::get( 'manage_page_id' ) ), true ) ) {
			hkr_no_cache();
		}
	}

	public static function robots( $robots ) {
		if ( self::is_private_page() ) {
			$robots['noindex']  = true;
			$robots['nofollow'] = true;
		}
		return $robots;
	}

	public static function rank_math_robots( $robots ) {
		if ( self::is_private_page() ) {
			$robots['index']  = 'noindex';
			$robots['follow'] = 'nofollow';
		}
		return $robots;
	}

	public static function rank_math_exclude( $ids ) {
		return array_merge( (array) $ids, self::private_page_ids() );
	}

	public static function core_sitemap_exclude( $args, $post_type ) {
		if ( 'page' === $post_type ) {
			$args['post__not_in'] = array_merge( isset( $args['post__not_in'] ) ? (array) $args['post__not_in'] : array(), self::private_page_ids() );
		}
		return $args;
	}

	public static function register_assets() {
		wp_register_style( 'hkr-booking', HKR_URL . 'assets/css/booking.css', array(), HKR_VERSION );
		wp_register_script( 'hkr-booking', HKR_URL . 'assets/js/booking.js', array(), HKR_VERSION, true );
		wp_register_style( 'hkr-staff', HKR_URL . 'assets/css/staff.css', array(), HKR_VERSION );
		wp_register_script( 'hkr-staff', HKR_URL . 'assets/js/staff.js', array(), HKR_VERSION, true );
	}

	private static function color_vars() {
		$primary = sanitize_hex_color( HKR_Settings::get( 'color_primary' ) );
		$dark    = sanitize_hex_color( HKR_Settings::get( 'color_dark' ) );
		return '--hkr-primary:' . ( $primary ? $primary : '#dd3333' ) . ';--hkr-dark:' . ( $dark ? $dark : '#111111' ) . ';';
	}

	/**
	 * [hakka_booking location="auto|port-of-spain|brentwood"]
	 */
	public static function booking_form( $atts ) {
		$atts = shortcode_atts( array( 'location' => 'auto' ), $atts, 'hakka_booking' );
		self::register_assets();
		wp_enqueue_style( 'hkr-booking' );
		wp_enqueue_script( 'hkr-booking' );

		$locations = array();
		foreach ( HKR_Locations::all( true ) as $loc ) {
			$locations[] = HKR_Locations::public_data( $loc );
		}
		$terms_page = (int) HKR_Settings::get( 'terms_page_id' );
		$default    = HKR_Settings::get( 'default_header_id' ) ? wp_get_attachment_image_url( (int) HKR_Settings::get( 'default_header_id' ), 'full' ) : '';
		$config     = array(
			'api'           => esc_url_raw( rest_url( HKR_Rest::NS ) ),
			'locations'     => $locations,
			'preselect'     => 'auto' === $atts['location'] ? '' : sanitize_title( $atts['location'] ),
			'defaultImage'  => $default ? $default : '',
			'celebrations'  => HKR_Settings::celebration_options(),
			'seating'       => 'off' === HKR_Settings::get( 'field_seating' ) ? null : array( 'options' => HKR_Settings::seating_options(), 'required' => 'required' === HKR_Settings::get( 'field_seating' ) ),
			'fields'        => array(
				'highChair' => HKR_Settings::get( 'field_high_chair' ),
				'dietary'   => HKR_Settings::get( 'field_dietary' ),
				'requests'  => HKR_Settings::get( 'field_requests' ),
			),
			'terms'         => HKR_Settings::get( 'terms_text' ),
			'termsUrl'      => $terms_page ? get_permalink( $terms_page ) : '',
			'turnstileSite' => HKR_Settings::get( 'turnstile_secret' ) ? (string) HKR_Settings::get( 'turnstile_site' ) : '',
			'i18n'          => self::booking_strings(),
		);
		if ( $config['turnstileSite'] ) {
			wp_enqueue_script( 'cf-turnstile', 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', array(), null, true ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
		}

		if ( ! $locations ) {
			return '<div class="hkr-booking hkr-booking--empty">' . esc_html__( 'Online booking is not available right now. Please call us to book a table.', 'hakka-reservations' ) . '</div>';
		}

		$id = 'hkr-booking-' . wp_rand( 1000, 99999 );
		ob_start();
		?>
		<div class="hkr-booking" id="<?php echo esc_attr( $id ); ?>" style="<?php echo esc_attr( self::color_vars() ); ?>" data-hkr-config="<?php echo esc_attr( wp_json_encode( $config ) ); ?>">
			<noscript><?php esc_html_e( 'Please turn on JavaScript to book online, or call us to book a table.', 'hakka-reservations' ); ?></noscript>
			<div class="hkr-loading" aria-live="polite"><?php esc_html_e( 'Loading booking form…', 'hakka-reservations' ); ?></div>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	private static function booking_strings() {
		return array(
			'chooseLocation'   => __( 'Choose a location', 'hakka-reservations' ),
			'chooseType'       => __( 'What are you booking?', 'hakka-reservations' ),
			'partySize'        => __( 'How many guests?', 'hakka-reservations' ),
			'guests'           => __( 'guests', 'hakka-reservations' ),
			'guest'            => __( 'guest', 'hakka-reservations' ),
			'chooseDate'       => __( 'Choose a date', 'hakka-reservations' ),
			'chooseTime'       => __( 'Choose a time', 'hakka-reservations' ),
			'yourDetails'      => __( 'Your details', 'hakka-reservations' ),
			'review'           => __( 'Check your booking', 'hakka-reservations' ),
			'next'             => __( 'Continue', 'hakka-reservations' ),
			'back'             => __( 'Back', 'hakka-reservations' ),
			'change'           => __( 'Change', 'hakka-reservations' ),
			'submit'           => __( 'Request booking', 'hakka-reservations' ),
			'sending'          => __( 'Sending…', 'hakka-reservations' ),
			'name'             => __( 'Full name', 'hakka-reservations' ),
			'phone'            => __( 'Phone number', 'hakka-reservations' ),
			'phoneHelp'        => __( 'We will call this number to confirm your booking.', 'hakka-reservations' ),
			'email'            => __( 'Email', 'hakka-reservations' ),
			'celebrating'      => __( 'Are you celebrating something?', 'hakka-reservations' ),
			'none'             => __( 'None', 'hakka-reservations' ),
			'other'            => __( 'Other', 'hakka-reservations' ),
			'celebratingWhat'  => __( 'Tell us what you\'re celebrating', 'hakka-reservations' ),
			'celebrationNote'  => __( 'Anything we should know? (optional, e.g. the birthday person\'s name)', 'hakka-reservations' ),
			'seating'          => __( 'Seating preference', 'hakka-reservations' ),
			'highChair'        => __( 'We need a high chair', 'hakka-reservations' ),
			'dietary'          => __( 'Dietary needs or allergies', 'hakka-reservations' ),
			'requests'         => __( 'Special requests', 'hakka-reservations' ),
			'optional'         => __( 'optional', 'hakka-reservations' ),
			'terms'            => __( 'I agree to the booking terms', 'hakka-reservations' ),
			'readTerms'        => __( 'Read the terms', 'hakka-reservations' ),
			'noSlots'          => __( 'No times left on this day. Please choose another date.', 'hakka-reservations' ),
			'closed'           => __( 'Closed', 'hakka-reservations' ),
			'spotsLeft'        => __( '%d spots left', 'hakka-reservations' ),
			'full'             => __( 'Full', 'hakka-reservations' ),
			'largeGroup'       => __( 'For groups larger than %1$d, please call us on %2$s.', 'hakka-reservations' ),
			'thanksTitle'      => __( 'Booking request received', 'hakka-reservations' ),
			'thanksRef'        => __( 'Your booking reference is %s.', 'hakka-reservations' ),
			'thanksEmail'      => __( 'We have emailed the details to %s.', 'hakka-reservations' ),
			'bookAnother'      => __( 'Make another booking', 'hakka-reservations' ),
			'error'            => __( 'Something went wrong. Please try again or call us.', 'hakka-reservations' ),
			'required'         => __( 'Please fill in this field.', 'hakka-reservations' ),
			'invalidEmail'     => __( 'Please enter a valid email address.', 'hakka-reservations' ),
			'location'         => __( 'Location', 'hakka-reservations' ),
			'type'             => __( 'Booking type', 'hakka-reservations' ),
			'date'             => __( 'Date', 'hakka-reservations' ),
			'time'             => __( 'Time', 'hakka-reservations' ),
			'party'            => __( 'Party size', 'hakka-reservations' ),
			'celebration'      => __( 'Celebration', 'hakka-reservations' ),
			'callUs'           => __( 'Call us', 'hakka-reservations' ),
			'directions'       => __( 'Directions', 'hakka-reservations' ),
			'prevMonth'        => __( 'Previous month', 'hakka-reservations' ),
			'nextMonth'        => __( 'Next month', 'hakka-reservations' ),
			'weekdays'         => array( __( 'Mo', 'hakka-reservations' ), __( 'Tu', 'hakka-reservations' ), __( 'We', 'hakka-reservations' ), __( 'Th', 'hakka-reservations' ), __( 'Fr', 'hakka-reservations' ), __( 'Sa', 'hakka-reservations' ), __( 'Su', 'hakka-reservations' ) ),
			'step'             => __( 'Step %1$d of %2$d', 'hakka-reservations' ),
		);
	}

	/**
	 * [hakka_manage_booking] – the page the guest's "Manage / cancel booking" link opens.
	 */
	public static function manage_page() {
		hkr_no_cache();
		self::register_assets();
		wp_enqueue_style( 'hkr-booking' );
		$ref     = isset( $_GET['hkr_ref'] ) ? sanitize_text_field( wp_unslash( $_GET['hkr_ref'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$token   = isset( $_GET['hkr_token'] ) ? sanitize_text_field( wp_unslash( $_GET['hkr_token'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
		$booking = $ref ? HKR_Bookings::get_by_ref( $ref ) : null;
		$valid   = $booking && HKR_Bookings::verify_token( $booking, $token );

		$notice = '';
		if ( $valid && isset( $_POST['hkr_manage_action'], $_POST['hkr_manage_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['hkr_manage_nonce'] ) ), 'hkr_manage_' . $booking['id'] ) ) {
			$action = sanitize_key( wp_unslash( $_POST['hkr_manage_action'] ) );
			if ( 'cancel' === $action ) {
				if ( HKR_Bookings::guest_can_cancel( $booking ) ) {
					$result = HKR_Bookings::guest_cancel( $booking );
					$notice = is_wp_error( $result ) ? $result->get_error_message() : __( 'Your booking has been cancelled. We have emailed you a confirmation.', 'hakka-reservations' );
				} else {
					$notice = __( 'This booking can no longer be cancelled online. Please call us.', 'hakka-reservations' );
				}
			} elseif ( 'change' === $action ) {
				$message = isset( $_POST['hkr_message'] ) ? sanitize_textarea_field( wp_unslash( $_POST['hkr_message'] ) ) : '';
				if ( mb_strlen( trim( $message ) ) >= 3 ) {
					HKR_Bookings::guest_request_change( $booking, $message );
					$notice = __( 'Thanks. We have passed your request to the restaurant and will call you.', 'hakka-reservations' );
				} else {
					$notice = __( 'Please tell us what you would like to change.', 'hakka-reservations' );
				}
			}
			$booking = HKR_Bookings::get( $booking['id'] );
		}

		ob_start();
		echo '<div class="hkr-booking hkr-manage" style="' . esc_attr( self::color_vars() ) . '">';
		if ( ! $valid ) {
			echo '<div class="hkr-card"><h2 class="hkr-title">' . esc_html__( 'Manage your booking', 'hakka-reservations' ) . '</h2><p>' . esc_html__( 'This link is not valid any more. Please use the link in your most recent email from us, or call the restaurant.', 'hakka-reservations' ) . '</p></div></div>';
			return (string) ob_get_clean();
		}
		$data = HKR_Rest::manage_public( $booking );
		?>
		<div class="hkr-card">
			<h2 class="hkr-title"><?php esc_html_e( 'Your booking', 'hakka-reservations' ); ?> <span class="hkr-ref"><?php echo esc_html( $data['ref'] ); ?></span></h2>
			<?php if ( $notice ) : ?>
				<div class="hkr-notice" role="status"><?php echo esc_html( $notice ); ?></div>
			<?php endif; ?>
			<dl class="hkr-summary">
				<dt><?php esc_html_e( 'Status', 'hakka-reservations' ); ?></dt><dd><strong><?php echo esc_html( $data['statusLabel'] ); ?></strong></dd>
				<dt><?php esc_html_e( 'Location', 'hakka-reservations' ); ?></dt><dd><?php echo esc_html( $data['location'] ); ?><br><small><?php echo esc_html( $data['address'] ); ?></small></dd>
				<dt><?php esc_html_e( 'Date', 'hakka-reservations' ); ?></dt><dd><?php echo esc_html( $data['date'] ); ?></dd>
				<dt><?php esc_html_e( 'Time', 'hakka-reservations' ); ?></dt><dd><?php echo esc_html( $data['time'] ); ?></dd>
				<dt><?php esc_html_e( 'Party size', 'hakka-reservations' ); ?></dt><dd><?php echo esc_html( $data['party'] ); ?></dd>
				<?php if ( $data['area'] ) : ?>
					<dt><?php esc_html_e( 'Booking type', 'hakka-reservations' ); ?></dt><dd><?php echo esc_html( $data['area'] ); ?></dd>
				<?php endif; ?>
			</dl>
			<?php if ( in_array( $booking['status'], array( 'pending', 'confirmed' ), true ) ) : ?>
				<form method="post" class="hkr-manage-form">
					<?php wp_nonce_field( 'hkr_manage_' . $booking['id'], 'hkr_manage_nonce' ); ?>
					<label class="hkr-label" for="hkr-message"><?php esc_html_e( 'Need to change something? Tell us and we will call you.', 'hakka-reservations' ); ?></label>
					<textarea id="hkr-message" name="hkr_message" class="hkr-input" rows="3" maxlength="1000"></textarea>
					<div class="hkr-actions">
						<button type="submit" name="hkr_manage_action" value="change" class="hkr-btn hkr-btn--ghost"><?php esc_html_e( 'Send change request', 'hakka-reservations' ); ?></button>
						<?php if ( $data['canCancel'] ) : ?>
							<button type="submit" name="hkr_manage_action" value="cancel" class="hkr-btn hkr-btn--danger" onclick="return confirm('<?php echo esc_js( __( 'Cancel this booking?', 'hakka-reservations' ) ); ?>');"><?php esc_html_e( 'Cancel booking', 'hakka-reservations' ); ?></button>
						<?php endif; ?>
					</div>
				</form>
				<?php if ( ! $data['canCancel'] ) : ?>
					<p class="hkr-help"><?php echo esc_html( sprintf( /* translators: %s: phone */ __( 'It is too close to your booking to cancel online. Please call us on %s.', 'hakka-reservations' ), $data['phone'] ) ); ?></p>
				<?php endif; ?>
			<?php endif; ?>
			<p class="hkr-help"><a href="tel:<?php echo esc_attr( $data['phoneRaw'] ); ?>"><?php echo esc_html( sprintf( /* translators: %s: phone */ __( 'Call %s', 'hakka-reservations' ), $data['phone'] ) ); ?></a></p>
		</div>
		</div>
		<?php
		return (string) ob_get_clean();
	}

	/**
	 * [hakka_staff_bookings] – the staff screen. Requires a login with booking access.
	 */
	public static function staff_screen() {
		hkr_no_cache();
		self::register_assets();
		wp_enqueue_style( 'hkr-staff' );

		if ( ! is_user_logged_in() ) {
			ob_start();
			?>
			<div class="hkr-staff hkr-staff--login" style="<?php echo esc_attr( self::color_vars() ); ?>">
				<div class="hkr-staff-login">
					<h2><?php esc_html_e( 'Staff bookings', 'hakka-reservations' ); ?></h2>
					<p><?php esc_html_e( 'Log in with your staff account to see and confirm bookings.', 'hakka-reservations' ); ?></p>
					<?php
					wp_login_form(
						array(
							'redirect'       => get_permalink(),
							'remember'       => false,
							'label_username' => __( 'Username or email', 'hakka-reservations' ),
						)
					);
					?>
					<p><a href="<?php echo esc_url( wp_lostpassword_url( get_permalink() ) ); ?>"><?php esc_html_e( 'Forgot your password?', 'hakka-reservations' ); ?></a></p>
				</div>
			</div>
			<?php
			return (string) ob_get_clean();
		}
		if ( ! current_user_can( 'hkr_view_bookings' ) ) {
			return '<div class="hkr-staff"><p>' . esc_html__( 'Your account does not have access to bookings. Please ask a manager.', 'hakka-reservations' ) . '</p></div>';
		}

		wp_enqueue_script( 'hkr-staff' );
		$user   = wp_get_current_user();
		$config = array(
			'api'          => esc_url_raw( rest_url( HKR_Rest::NS ) ),
			'nonce'        => wp_create_nonce( 'wp_rest' ),
			'canEdit'      => current_user_can( 'hkr_edit_bookings' ),
			'pollSeconds'  => max( 10, (int) HKR_Settings::get( 'staff_poll_seconds' ) ),
			'user'         => $user->display_name,
			'logoutUrl'    => wp_logout_url( get_permalink() ),
			'adminUrl'     => current_user_can( 'hkr_manage' ) ? admin_url( 'admin.php?page=hkr-bookings' ) : '',
			'statuses'     => hkr_statuses(),
			'sources'      => hkr_sources(),
			'celebrations' => HKR_Settings::celebration_options(),
			'openBooking'  => isset( $_GET['hkr_booking'] ) ? absint( $_GET['hkr_booking'] ) : 0, // phpcs:ignore WordPress.Security.NonceVerification
			'openDate'     => isset( $_GET['hkr_date'] ) && HKR_Availability::valid_date( sanitize_text_field( wp_unslash( $_GET['hkr_date'] ) ) ) ? sanitize_text_field( wp_unslash( $_GET['hkr_date'] ) ) : '', // phpcs:ignore WordPress.Security.NonceVerification
		);
		return '<div class="hkr-staff" style="' . esc_attr( self::color_vars() ) . '" data-hkr-staff="' . esc_attr( wp_json_encode( $config ) ) . '"><div class="hkr-loading">' . esc_html__( 'Loading bookings…', 'hakka-reservations' ) . '</div></div>';
	}
}
