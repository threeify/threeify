#pragma include <tests/fragment>
#pragma include "mat2"
#pragma include "mat3"
#pragma include <math/math>

void testMatEquals( inout TestSuite suite, int id, mat3 m, mat3 target ) {
  for( int i = 0; i < 3; i ++ ) {
    for( int j = 0; j < 3; j ++ ) {
      assert( suite, id + i*3 + j, eqAbs( m[i][j], target[i][j], 0.000001 ) );
    }
  }
}

void tests( inout TestSuite suite ) {

  mat3 uninitialized;

  mat3 zero = mat3( 0., 0., 0., 0., 0., 0., 0., 0., 0. );
  testMatEquals( suite, 40, uninitialized, zero );

  mat3 easyIdentity = mat3(1.0);
  testMatEquals( suite, 60, easyIdentity, mat3Identity() );

  mat3 reference = mat3( 0., 1., 2., 3., 4., 5., 6., 7., 8. );

  mat3 refByIdentity = reference * mat3Identity();
  testMatEquals( suite, 80, refByIdentity, reference );

  mat3 vec = mat3( vec3( 0., 1., 2. ), vec3( 3., 4., 5. ), vec3( 6., 7., 8. ) );
  testMatEquals( suite, 100, vec, reference );

  mat3 manual;
  manual[0] = vec3( 0., 1., 2. );
  manual[1].zyx = vec3( 5., 4., 3. );
  manual[2].x = 6.;
  manual[2][1] = 7.;
  manual[2][2] = 8.;
  testMatEquals( suite, 120, manual, reference );

  mat2 m2rot90 = mat2Rotate( degToRad( 90. ) );
  mat3 m3fromm2 = mat3( m2rot90 );  // This is a neat feature.
  mat3 m3rot90 = mat3RotateZ( degToRad( 90. ) );

  testMatEquals( suite, 200, m3fromm2, m3rot90 );
}
