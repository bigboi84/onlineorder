<?php
/**
 * wp-admin menu and shared admin helpers.
 *
 * @package HakkaReservations
 */

defined( 'ABSPATH' ) || exit;

class HKR_Admin {

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notices' ) );
		HKR_Admin_Bookings::init();
		HKR_Admin_Locations::init();
		HKR_Admin_Settings::init();
		HKR_Admin_Staff::init();
		HKR_Admin_Reports::init();
	}

	public static function menu() {
		$pending = HKR_Bookings::query(
			array(
				'status'    => 'pending',
				'date_from' => hkr_now()->format( 'Y-m-d' ),
				'limit'     => 0,
			)
		);
		$badge = $pending['total'] ? ' <span class="awaiting-mod">' . (int) $pending['total'] . '</span>' : '';

		add_menu_page( __( 'Reservations', 'hakka-reservations' ), __( 'Reservations', 'hakka-reservations' ) . $badge, 'hkr_edit_bookings', 'hkr-bookings', array( 'HKR_Admin_Bookings', 'page' ), 'dashicons-food', 26 );
		add_submenu_page( 'hkr-bookings', __( 'Bookings', 'hakka-reservations' ), __( 'Bookings', 'hakka-reservations' ), 'hkr_edit_bookings', 'hkr-bookings', array( 'HKR_Admin_Bookings', 'page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Add booking', 'hakka-reservations' ), __( 'Add booking', 'hakka-reservations' ), 'hkr_edit_bookings', 'hkr-booking-edit', array( 'HKR_Admin_Bookings', 'edit_page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Locations', 'hakka-reservations' ), __( 'Locations', 'hakka-reservations' ), 'hkr_manage', 'hkr-locations', array( 'HKR_Admin_Locations', 'page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Booking staff', 'hakka-reservations' ), __( 'Booking staff', 'hakka-reservations' ), 'hkr_manage', 'hkr-staff', array( 'HKR_Admin_Staff', 'page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Messages & Email', 'hakka-reservations' ), __( 'Messages & Email', 'hakka-reservations' ), 'hkr_manage', 'hkr-messages', array( 'HKR_Admin_Settings', 'messages_page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Settings', 'hakka-reservations' ), __( 'Settings', 'hakka-reservations' ), 'hkr_manage', 'hkr-settings', array( 'HKR_Admin_Settings', 'page' ) );
		add_submenu_page( 'hkr-bookings', __( 'Reports', 'hakka-reservations' ), __( 'Reports', 'hakka-reservations' ), 'hkr_manage', 'hkr-reports', array( 'HKR_Admin_Reports', 'page' ) );
	}

	public static function assets( $hook ) {
		if ( false === strpos( (string) $hook, 'hkr-' ) ) {
			return;
		}
		wp_enqueue_style( 'hkr-admin', HKR_URL . 'assets/css/admin.css', array(), HKR_VERSION );
		wp_enqueue_script( 'hkr-admin', HKR_URL . 'assets/js/admin.js', array( 'jquery' ), HKR_VERSION, true );
		wp_localize_script(
			'hkr-admin',
			'hkrAdmin',
			array(
				'api'          => esc_url_raw( rest_url( HKR_Rest::NS ) ),
				'nonce'        => wp_create_nonce( 'wp_rest' ),
				'chooseImage'  => __( 'Choose image', 'hakka-reservations' ),
				'useImage'     => __( 'Use this image', 'hakka-reservations' ),
				'removeConfirm' => __( 'Remove this row?', 'hakka-reservations' ),
				'noSlots'      => __( 'No times on this day.', 'hakka-reservations' ),
			)
		);
		if ( false !== strpos( (string) $hook, 'hkr-locations' ) || false !== strpos( (string) $hook, 'hkr-settings' ) ) {
			wp_enqueue_media();
		}
	}

	/**
	 * Redirect back to a screen with a message (shown by notices()).
	 */
	public static function redirect( $url, $message = '', $type = 'success' ) {
		if ( $message ) {
			set_transient( 'hkr_notice_' . get_current_user_id(), array( 'message' => $message, 'type' => $type ), 60 );
		}
		wp_safe_redirect( $url );
		exit;
	}

	public static function notices() {
		$screen = get_current_screen();
		if ( ! $screen || false === strpos( (string) $screen->id, 'hkr-' ) ) {
			return;
		}
		$key    = 'hkr_notice_' . get_current_user_id();
		$notice = get_transient( $key );
		if ( $notice ) {
			delete_transient( $key );
			printf( '<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>', esc_attr( 'error' === $notice['type'] ? 'error' : 'success' ), esc_html( $notice['message'] ) );
		}
	}

	public static function check( $cap, $nonce_action ) {
		if ( ! current_user_can( $cap ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'hakka-reservations' ), 403 );
		}
		check_admin_referer( $nonce_action );
	}

	/**
	 * Media-library picker for an image ID field.
	 */
	public static function image_field( $name, $attachment_id, $help = '' ) {
		$url = $attachment_id ? wp_get_attachment_image_url( (int) $attachment_id, 'medium' ) : '';
		?>
		<div class="hkr-image-field">
			<input type="hidden" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( (int) $attachment_id ); ?>" class="hkr-image-id">
			<div class="hkr-image-preview"><?php if ( $url ) : ?><img src="<?php echo esc_url( $url ); ?>" alt=""><?php endif; ?></div>
			<button type="button" class="button hkr-image-choose"><?php esc_html_e( 'Choose image', 'hakka-reservations' ); ?></button>
			<button type="button" class="button-link hkr-image-remove" <?php echo $url ? '' : 'hidden'; ?>><?php esc_html_e( 'Remove', 'hakka-reservations' ); ?></button>
			<?php if ( $help ) : ?><p class="description"><?php echo esc_html( $help ); ?></p><?php endif; ?>
		</div>
		<?php
	}
}
