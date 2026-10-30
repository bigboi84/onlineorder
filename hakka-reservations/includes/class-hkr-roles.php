<?php
/**
 * Roles: Reservations Manager and HAKKA Booking Staff, staff login flow and username privacy.
 *
 * Capabilities:
 *  - hkr_view_bookings   see bookings (staff screen)
 *  - hkr_edit_bookings   confirm, change, add bookings
 *  - hkr_manage          locations, hours, capacity, settings, staff accounts, reports
 *
 * @package HakkaReservations
 */

defined( 'ABSPATH' ) || exit;

class HKR_Roles {

	const STAFF   = 'hkr_staff';
	const MANAGER = 'hkr_manager';

	public static function init() {
		add_filter( 'login_redirect', array( __CLASS__, 'login_redirect' ), 20, 3 );
		add_action( 'admin_init', array( __CLASS__, 'keep_staff_out_of_admin' ) );
		add_filter( 'show_admin_bar', array( __CLASS__, 'admin_bar' ) );
		add_filter( 'auth_cookie_expiration', array( __CLASS__, 'staff_session_length' ), 20, 3 );
		add_action( 'show_user_profile', array( __CLASS__, 'profile_fields' ) );
		add_action( 'edit_user_profile', array( __CLASS__, 'profile_fields' ) );
		add_action( 'personal_options_update', array( __CLASS__, 'save_profile_fields' ) );
		add_action( 'edit_user_profile_update', array( __CLASS__, 'save_profile_fields' ) );

		if ( HKR_Settings::get( 'hide_usernames' ) ) {
			add_action( 'template_redirect', array( __CLASS__, 'block_author_archives' ), 1 );
			add_filter( 'rest_endpoints', array( __CLASS__, 'hide_user_endpoints' ) );
			add_filter( 'the_author_posts_link', array( __CLASS__, 'author_link_text_only' ) );
			add_filter( 'author_link', array( __CLASS__, 'author_link_home' ) );
		}
	}

	public static function add_roles() {
		$staff_caps = array(
			'read'              => true,
			'hkr_view_bookings' => true,
			'hkr_edit_bookings' => true,
		);
		$manager_caps = array_merge(
			$staff_caps,
			array(
				'hkr_manage'   => true,
				'upload_files' => true, // For location header images.
			)
		);
		remove_role( self::STAFF );
		remove_role( self::MANAGER );
		add_role( self::STAFF, __( 'HAKKA Booking Staff', 'hakka-reservations' ), $staff_caps );
		add_role( self::MANAGER, __( 'Reservations Manager', 'hakka-reservations' ), $manager_caps );

		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( array( 'hkr_view_bookings', 'hkr_edit_bookings', 'hkr_manage' ) as $cap ) {
				$admin->add_cap( $cap );
			}
		}
	}

	public static function remove_roles() {
		remove_role( self::STAFF );
		remove_role( self::MANAGER );
		$admin = get_role( 'administrator' );
		if ( $admin ) {
			foreach ( array( 'hkr_view_bookings', 'hkr_edit_bookings', 'hkr_manage' ) as $cap ) {
				$admin->remove_cap( $cap );
			}
		}
	}

	public static function is_staff_only( $user ) {
		return $user instanceof WP_User && in_array( self::STAFF, (array) $user->roles, true ) && ! $user->has_cap( 'hkr_manage' ) && ! $user->has_cap( 'edit_posts' );
	}

	public static function staff_url() {
		$page = (int) HKR_Settings::get( 'staff_page_id' );
		return $page ? get_permalink( $page ) : home_url( '/' );
	}

	public static function login_redirect( $redirect_to, $requested, $user ) {
		if ( self::is_staff_only( $user ) ) {
			return self::staff_url();
		}
		return $redirect_to;
	}

	/**
	 * Booking staff only use the staff screen. Profile (password change) stays reachable.
	 */
	public static function keep_staff_out_of_admin() {
		if ( wp_doing_ajax() || ! is_user_logged_in() ) {
			return;
		}
		$user = wp_get_current_user();
		if ( ! self::is_staff_only( $user ) ) {
			return;
		}
		global $pagenow;
		if ( 'profile.php' === $pagenow ) {
			return;
		}
		wp_safe_redirect( self::staff_url() );
		exit;
	}

	public static function admin_bar( $show ) {
		return self::is_staff_only( wp_get_current_user() ) ? false : $show;
	}

	/**
	 * Booking staff are logged out after the configured number of hours.
	 */
	public static function staff_session_length( $seconds, $user_id, $remember ) {
		$user = get_userdata( $user_id );
		if ( $user && self::is_staff_only( $user ) ) {
			$hours = max( 1, (int) HKR_Settings::get( 'staff_session_hours' ) );
			return $hours * HOUR_IN_SECONDS;
		}
		return $seconds;
	}

	/**
	 * Which locations a staff member sees, on their profile.
	 */
	public static function profile_fields( $user ) {
		if ( ! current_user_can( 'hkr_manage' ) || ! current_user_can( 'edit_user', $user->ID ) ) {
			return;
		}
		$assigned = array_map( 'intval', (array) get_user_meta( $user->ID, 'hkr_locations', true ) );
		?>
		<h2><?php esc_html_e( 'HAKKA Reservations', 'hakka-reservations' ); ?></h2>
		<table class="form-table" role="presentation">
			<tr>
				<th><?php esc_html_e( 'Locations this person can see', 'hakka-reservations' ); ?></th>
				<td>
					<?php wp_nonce_field( 'hkr_profile_' . $user->ID, 'hkr_profile_nonce' ); ?>
					<?php foreach ( HKR_Locations::all() as $loc ) : ?>
						<label style="display:block;margin-bottom:4px;">
							<input type="checkbox" name="hkr_locations[]" value="<?php echo esc_attr( $loc['id'] ); ?>" <?php checked( in_array( $loc['id'], $assigned, true ) ); ?>>
							<?php echo esc_html( $loc['name'] ); ?>
						</label>
					<?php endforeach; ?>
					<p class="description"><?php esc_html_e( 'Booking staff only see bookings for the locations ticked here. Managers and administrators see every location.', 'hakka-reservations' ); ?></p>
				</td>
			</tr>
		</table>
		<?php
	}

	public static function save_profile_fields( $user_id ) {
		if ( ! current_user_can( 'hkr_manage' ) || ! current_user_can( 'edit_user', $user_id ) ) {
			return;
		}
		if ( ! isset( $_POST['hkr_profile_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['hkr_profile_nonce'] ) ), 'hkr_profile_' . $user_id ) ) {
			return;
		}
		$ids = isset( $_POST['hkr_locations'] ) ? array_map( 'intval', (array) wp_unslash( $_POST['hkr_locations'] ) ) : array();
		update_user_meta( $user_id, 'hkr_locations', array_values( array_filter( $ids ) ) );
	}

	/* ----- Username privacy (the audit found the admin username on a public page) ----- */

	public static function block_author_archives() {
		if ( is_author() || ( isset( $_GET['author'] ) && ! is_admin() ) ) { // phpcs:ignore WordPress.Security.NonceVerification
			wp_safe_redirect( home_url( '/' ), 301 );
			exit;
		}
	}

	public static function hide_user_endpoints( $endpoints ) {
		if ( is_user_logged_in() ) {
			return $endpoints;
		}
		foreach ( array_keys( $endpoints ) as $route ) {
			if ( 0 === strpos( $route, '/wp/v2/users' ) ) {
				unset( $endpoints[ $route ] );
			}
		}
		return $endpoints;
	}

	public static function author_link_text_only( $link ) {
		return wp_strip_all_tags( $link );
	}

	public static function author_link_home() {
		return home_url( '/' );
	}
}
