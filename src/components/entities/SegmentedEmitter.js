import React, { Component, PropTypes } from 'react';
import THREE from 'three';
import p2 from 'p2';
import { v3toP2, p2ToV3 } from '../../helpers/Utils';

const bubbleMinSize = 0.5;
const foamGrowSize = 0.3;
const foamGrowSpeed = 5.2;
const foamSpeed = 4.2;
const minimumPercentToShowFoam = 0.9;

// Computed values

const colRotation = new THREE.Euler( -Math.PI / 2, 0, Math.PI / 2 );
const toScreenRotation = new THREE.Euler( -Math.PI / 2, 0, 0 );
const axis = new THREE.Vector3( 0, -1, 0 );
// Which way the emitter flows by default
const forwardDirection = new THREE.Vector3( 1, 0, 0 );
const helperRotation = new THREE.Euler( 0, -Math.PI / 2, 0 );
const helperPosition = new THREE.Vector3( -0.5, 0, 0 );

const relativeImpulsePoint = [ 0, 0 ];

export default class SegmentedEmitter extends Component {

    static propTypes = {
        position: PropTypes.object.isRequired,
        rotation: PropTypes.object,
        quaternion: PropTypes.object,
        scale: PropTypes.object,
        world: PropTypes.object,
        paused: PropTypes.bool,
        time: PropTypes.number,
        playerRadius: PropTypes.number,
        playerBody: PropTypes.object,
        maxLength: PropTypes.number.isRequired,
        impulse: PropTypes.number.isRequired,
        rayCount: PropTypes.number.isRequired,
        materialId: PropTypes.string.isRequired,
        foamMaterialId: PropTypes.string,
        foam: PropTypes.bool,
    }

    constructor( props, context ) {

        super( props, context );

        this.state = this.getStateFromProps( props, {} );

        this._onUpdate = this._onUpdate.bind( this );

    }

    componentWillReceiveProps( nextProps:Object ) {

        if( ( nextProps.playerRadius !== this.props.playerRadius ) ||
           ( nextProps.quaternion !== this.props.quaternion ) ||
           ( nextProps.rotation !== this.props.rotation ) ||
           ( nextProps.position !== this.props.position )
        ) {

            this.setState( this.getStateFromProps( nextProps, this.state ) );

        }

    }

    getStateFromProps( props:Object, state:Object ) {

        const {
            position, quaternion, rotation, playerRadius, scale, maxLength,
            rayCount
        } = props;

        const rotationQuaternion = rotation ?
            new THREE.Quaternion().setFromEuler( rotation ) :
            ( quaternion || new THREE.Quaternion( 0, 0, 0, 1 ) );

        // dam son see http://stackoverflow.com/questions/5501581/javascript-new-arrayn-and-array-prototype-map-weirdness
        const rayArray = new Array( rayCount ).fill( 0 );
        const angle = new THREE.Euler().setFromQuaternion( rotationQuaternion ).y;
        const impulse = ( props.impulse / rayCount );
        const playerImpulse = ( props.impulse / rayCount ) * ( playerRadius || 0.45 );
        const flowDirection = forwardDirection.clone().applyQuaternion( rotationQuaternion );

        return {
            rayArray,

            // The actual lenghts tweening towards targets
            lengths: state.lengths || rayArray.map( () => 1 ),

            // Where the waterfall should be ideally based on hit test
            lengthTargets: state.lengths || rayArray.map( () => 1 ),

            counter: 0,
            flowDirection2D: new THREE.Vector2( flowDirection.x, flowDirection.z ),
            hitVectors: rayArray.map( ( zero, index ) => {

                const streamHalfWidth = ( 0.5 / rayCount );

                // Construct the *local* unrotated vectors that define this
                // stream in local space
                const fromVectorInitial = new THREE.Vector3(
                    // move close to left edge of emitter
                    -0.499999,
                    // move toward the back to intersect player
                    -0.5 + ( playerRadius || 0.45 ),
                    // move to rectangle offset by index
                    -0.5 + /* center */( ( 1 / rayCount ) * index ) + streamHalfWidth
                ).multiply( scale );

                // The scale stuff was added in haste and might need some
                // tweaking later. Basically we're trying convert all these
                // world points to the correct scale
                const toVectorInitial = new THREE.Vector3(
                    fromVectorInitial.x + ( maxLength * scale.y ),
                    fromVectorInitial.y,
                    fromVectorInitial.z,
                );

                // Calculate the initial two points for the hit test rectangle
                // to do box test on. These are world points
                const a = fromVectorInitial
                    .clone()
                    .sub( new THREE.Vector3( 0, 0, streamHalfWidth * scale.y ) )
                    .applyQuaternion( rotationQuaternion )
                    .multiply( scale )
                    .add( position );

                const b = fromVectorInitial
                    .clone()
                    .add( new THREE.Vector3( 0, 0, streamHalfWidth * scale.y ) )
                    .applyQuaternion( rotationQuaternion )
                    .multiply( scale )
                    .add( position );

                const startingPoints = {
                    a: new THREE.Vector2( a.x, a.z ),
                    b: new THREE.Vector2( b.x, b.z ),
                };

                // Note, these are all in world space except for the impulse
                return {
                    fromVector2D: v3toP2(
                        fromVectorInitial.applyQuaternion( rotationQuaternion ).add( position )
                    ),
                    toVector2D: v3toP2(
                        toVectorInitial.applyQuaternion( rotationQuaternion ).add( position )
                    ),
                    impulseVector2D: v3toP2(
                        new THREE.Vector3( impulse, 0, 0 ).applyQuaternion( rotationQuaternion )
                    ),
                    playerImpulseVector2D: v3toP2(
                        new THREE.Vector3( playerImpulse, 0, 0 ).applyQuaternion( rotationQuaternion )
                    ),
                    startingPoints,
                };

            })
        };

    }

    _onUpdate() {
        
        const {
            world, position, paused, playerBody, playerRadius, maxLength,
            scale,
        } = this.props;

        const {
            counter, rayArray, hitVectors, flowDirection2D,
            lengths: oldLengths,
            lengthTargets: oldLengthTargets,
        } = this.state;

        if( !world || paused ) {
            return;
        }

        const playerBox = new THREE.Box2().setFromCenterAndSize(
            new THREE.Vector2( playerBody.position[ 0 ], playerBody.position[ 1 ] ),
            new THREE.Vector2( playerRadius * 1.9, playerRadius * 1.9 ),
        );

        let lengthTargets = oldLengthTargets;

        const boxes = [];

        lengthTargets = rayArray.map( ( zero, index ) => {

            const {
                fromVector2D, toVector2D, impulseVector2D, startingPoints,
                playerImpulseVector2D
            } = hitVectors[ index ];

            const ray = new p2.Ray({
                mode: p2.Ray.CLOSEST,
                from: fromVector2D,
                to: toVector2D,
            });

            const result = new p2.RaycastResult();
            world.raycast( result, ray );

            const { body } = result;
            const distance = result.getHitDistance( ray );
            let hitLength;

            if( body ) {

                if( body !== playerBody ) {

                    const { mass, position: bodyPosition, } = body;
                    if( mass ) {
                        body.applyImpulse( impulseVector2D, relativeImpulsePoint );
                    }

                }
                hitLength = distance;

            } else {

                hitLength = maxLength * scale.y;

            }

            const { a, b } = startingPoints;

            const points = [ a, b,
                a.clone().add( flowDirection2D.clone().multiplyScalar( hitLength * 1.1 ) ),
                b.clone().add( flowDirection2D.clone().multiplyScalar( hitLength * 1.1 ) )
            ];

            const box = new THREE.Box2().setFromPoints( points );
            boxes.push( box );

            if( box.intersectsBox( playerBox ) ) {

                playerBody.applyImpulse( playerImpulseVector2D, relativeImpulsePoint );
                hitLength = Math.min(
                    body === playerBody ?
                        hitLength :
                        p2.vec2.distance( fromVector2D, playerBody.position ),
                    maxLength * scale.y
                );

            }

            return hitLength;

        });

        const lengths = oldLengths.map( ( length, index ) => {
            const target = lengthTargets[ index ];
            return target > length ? Math.min( length + 0.2, target ) : target;
        });

        this.setState({
            counter: counter + 1,
            lengths, lengthTargets, boxes, playerBox
        });

    }

    render() {

        const {
            position, rotation, quaternion, scale, time, materialId,
            playerRadius, foamMaterialId, rayCount, foam, helperMaterialId,
            debug
        } = this.props;
        const { lengths, lengthTargets, rayArray, } = this.state;
        const waterfallHeight = -0.5 + ( playerRadius || 0.45 );

        return <group>
            <group
                position={ position }
                quaternion={ quaternion }
                rotation={ rotation }
                scale={ scale }
                onUpdate={ this._onUpdate }
            >
                { helperMaterialId ? <mesh
                    position={ helperPosition }
                    rotation={ helperRotation }
                >
                    <geometryResource
                        resourceId="1x1plane"
                    />
                    <materialResource
                        resourceId={ helperMaterialId }
                    />
                </mesh> : null}
                {/* for selectability */}
                <mesh
                    ref="mesh"
                >
                    <geometryResource
                        resourceId="1x1box"
                    />
                    <materialResource
                        resourceId="transparent"
                    />
                </mesh>

                {/* Foam */}
                { foam ? rayArray.map( ( zero, index ) => {

                    const length = lengths[ index ];
                    const target = lengthTargets[ index ];
                    const percentToTarget = Math.max(
                        ( 1.0 - ( Math.abs( target - length ) / target ) ) - minimumPercentToShowFoam,
                        0
                    ) * ( 1 / ( 1 - minimumPercentToShowFoam ) );

                    return <group
                        key={ index }
                        position={ new THREE.Vector3(
                            -0.5 + length,
                            waterfallHeight,
                            -0.5 + ( ( 1 / rayCount ) * index ) + ( 0.5 / rayCount ),
                        ) }
                        scale={
                            new THREE.Vector3( 1, 1, 1 ).multiplyScalar( 1 / rayCount )
                        }
                    >
                        <mesh
                            position={ new THREE.Vector3(
                                0, 0, -0.25
                            ) }
                            scale={
                                new THREE.Vector3( 1, 1, 1 )
                                    .multiplyScalar(
                                        ( bubbleMinSize * 2 + foamGrowSize * Math.sin( foamGrowSpeed * time * 0.6 - index ) ) *
                                        percentToTarget
                                    )
                            }
                            rotation={ new THREE.Euler(
                                ( foamSpeed * time - index ) * 0.1,
                                ( foamSpeed * time + index ) * 1.1,
                                foamSpeed * time
                            )}
                        >
                            <geometryResource
                                resourceId="radius1sphere"
                            />
                            <materialResource
                                resourceId={ foamMaterialId || 'waterFoam' }
                            />
                        </mesh>
                        <mesh
                            position={ new THREE.Vector3(
                                0, 0, 0.25
                            ) }
                            scale={
                                new THREE.Vector3( 1, 1, 1 )
                                    .multiplyScalar(
                                        ( bubbleMinSize * 2 + foamGrowSize * Math.cos( foamGrowSpeed * time * 1.2 + index ) ) *
                                        percentToTarget
                                    )
                            }
                            rotation={ new THREE.Euler(
                                ( foamSpeed * time + index ) * 0.6,
                                foamSpeed * time,
                                ( foamSpeed * time + index ) * 1.2,
                            )}
                        >
                            <geometryResource
                                resourceId="radius1sphere"
                            />
                            <materialResource
                                resourceId={ foamMaterialId || 'waterFoam' }
                            />
                        </mesh>
                    </group>;

                }) : null }

                {/* Emitters */}
                { rayArray.map( ( zero, index ) =>
                    <mesh
                        key={ index }
                        position={ new THREE.Vector3(
                            -0.5 + ( lengths[ index ] / 2 ),
                            waterfallHeight,
                            -0.5 + ( ( 1 / rayCount ) * index ) + ( 0.5 / rayCount )
                        ) }
                        scale={ new THREE.Vector3(
                            1 / rayCount,
                            lengths[ index ],
                            1,
                        ) }
                        rotation={ colRotation }
                    >
                        <geometryResource
                            resourceId="1x1plane"
                        />
                        <materialResource
                            resourceId={ materialId }
                        />
                    </mesh>
                )}

            </group>

            { debug ? <mesh
                position={ p2ToV3( this.state.hitVectors[ 0 ].toVector2D ) }
                scale={ new THREE.Vector3( 0.5, 3, 0.5 ) }
            >
                <geometryResource
                    resourceId="radius1sphere"
                />
                <materialResource
                    resourceId="greenDebugMaterial"
                />
            </mesh> : null }
            { debug ? <mesh
                position={ p2ToV3( this.state.hitVectors[ 0 ].fromVector2D ) }
                scale={ new THREE.Vector3( 0.5, 3, 0.5 ) }
            >
                <geometryResource
                    resourceId="radius1sphere"
                />
                <materialResource
                    resourceId="blueDebugMaterial"
                />
            </mesh> : null }
            { debug ? this.state.boxes.map( ( box, index ) => <mesh
                key={ index }
                position={ new THREE.Vector3( box.center().x, 2, box.center().y ) }
                scale={ new THREE.Vector3( box.size().x, box.size().y + 2, 1 ) }
                rotation={ toScreenRotation }
            >
                <geometryResource
                    resourceId="1x1plane"
                />
                <materialResource
                    resourceId={ index % 2 ? 'purpleDebugMaterial' : 'greenDebugMaterial' }
                />
            </mesh> ) : null }
            { debug && 0 ? <mesh
                position={ new THREE.Vector3( this.state.playerBox.center().x, 2, this.state.playerBox.center().y ) }
                scale={ new THREE.Vector3( this.state.playerBox.size().x, this.state.playerBox.size().y, 1 ) }
                rotation={ toScreenRotation }
            >
                <geometryResource
                    resourceId="1x1plane"
                />
                <materialResource
                    resourceId="purpleDebugMaterial"
                />
            </mesh> : null }
        </group>;


    }

}
