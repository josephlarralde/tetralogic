// add types: ["node"] to tsconfig.app.json for 'events' to work
import { EventEmitter } from 'events';
import {
  Mesh,
  Quaternion,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
} from 'three';

// todo : remove dependency to events as we're not using emitted events

class SphereModelVersorControl extends EventEmitter {

  container: HTMLElement
  width: number
  height: number
  scene: Scene
  camera: PerspectiveCamera
  sphere: Mesh
  pointer: Vector2
  pointerIsDown: boolean
  pointerIsOver: boolean
  raycaster: Raycaster
  lastPointerPosition: Vector3
  lastDragDate: number
  lastUpdateDate: number
  rotationAxis: Vector3
  rotationAngle: number
  angularSpeed: number
  friction: number
  
  constructor(
    $container: HTMLElement,
    scene: Scene,
    camera: PerspectiveCamera,
    sphere: Mesh
  ) {
    super();
    
    this.container = $container
    const { clientWidth: width, clientHeight: height } = this.container
    this.width = width
    this.height = height

    this.scene = scene
    this.camera = camera
    this.sphere = sphere

    this.pointer = new Vector2(-1, -1)
    this.pointerIsDown = false
    this.pointerIsOver = false // pointer can be down but lose focus
    this.raycaster = new Raycaster()
    // this.filter = new Filter(3)
    // this.filter.setAlpha(0.95)
    this.lastPointerPosition = new Vector3(0,0,0)
    this.lastDragDate = 0
    this.lastUpdateDate = 0

    this.rotationAxis = new Vector3(0,1,0)
    this.rotationAngle = 0
    
    // this.dt = 0; // not needed, tmp variable
    this.angularSpeed = 0

    this.friction = 0.15 // 0 : no friction, 1 : infinite friction

    this.container.addEventListener('pointermove', this.onPointerMove.bind(this))
    this.container.addEventListener('pointerdown', this.onPointerDown.bind(this))
    this.container.addEventListener('pointerup', this.onPointerUp.bind(this))
  }

  getPointerPosition(e: PointerEvent) {
    this.pointer.x = e.offsetX / this.width * 2 - 1
    this.pointer.y = -e.offsetY / this.height * 2 + 1

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true)

    let point: Vector3|null = null
    for (let i = 0; i < intersects.length; ++i) {
      if (intersects[i].object.uuid === this.sphere.uuid) {
        point = intersects[i].point
        break;
      }
    }

    const sg = this.sphere.geometry as SphereGeometry
    const R = sg.parameters.radius
    const blend_start = 0.85 * R
    const r_max = 1.2 * R
    // const blend_start = 0.85 * R
    // const r_max = 1.5 * R

    if (point !== null) {
      // Sur la sphère : blend vers hyperboloïde près du bord
      const r = Math.sqrt(point.x * point.x + point.y * point.y)
      if (r > blend_start) {
        const t = (r - blend_start) / (R - blend_start) // ∈ [0,1]
        const s = t * t * (3 - 2 * t)                   // smoothstep
        const z_hyp = (blend_start / Math.SQRT2) ** 2 / Math.max(r, 1e-6)
        point.z = point.z * (1 - s) + z_hyp * s
      }
    } else {
      // Hors sphère : projeter le rayon sur le plan z=0 pour obtenir x,y
      const ray = this.raycaster.ray
      const t = -ray.origin.z / ray.direction.z
      const x = ray.origin.x + t * ray.direction.x
      const y = ray.origin.y + t * ray.direction.y
      let r = Math.sqrt(x * x + y * y)

      r = Math.min(r, r_max)
      // if (r > r_max) return this.lastPointerPosition.clone()

      const z_hyp = (blend_start / Math.SQRT2) ** 2 / Math.max(r, 1e-6)
      const t_out = (r - R) / (r_max - R) // ATTENTION r_max MUST BE > R !!!
      const s = t_out * t_out * (3 - 2 * t_out)
      point = new Vector3(x, y, z_hyp * (1 - s))
    }

    //return point//.normalize()

    const { x, y } = this.pointer
    const r2 = x*x + y*y
    if (r2 < 1e-10) return this.lastPointerPosition.clone().normalize()
    let r = Math.sqrt(r2)
    let z
    let radius

    /*
    const radius = 1.0;
    const r_max = 1.5; // distance à partir de laquelle z = 0 exactement
    const k = 5.0;    // "raideur" de la sigmoïde, à doser

    if (r <= radius) {
      z = Math.sqrt(radius * radius - r * r);
    } else if (r < r_max) {
      // t ∈ [0,1] : progression entre le bord et r_max
      const t = (r - radius) / (r_max - radius);
      // sigmoïde qui vaut 1 en t=0 et 0 en t=1
      const z_edge = 0; // z au bord de la sphère (= 0 quand r=radius)
      const sigmoid = 1 - (1 / (1 + Math.exp(-k * (t - 0.5))));
      const sigmoid_0 = 1 - (1 / (1 + Math.exp(-k * (0 - 0.5))));
      const sigmoid_1 = 1 - (1 / (1 + Math.exp(-k * (1 - 0.5))));
      // on normalise pour que sigmoid(0)=1 et sigmoid(1)=0 exactement
      z = (sigmoid - sigmoid_1) / (sigmoid_0 - sigmoid_1) * z_edge;
    } else {
      z = 0;
    }
    //*/

    // ou : 
    /*
    const radius = 1.0;
    const blend_start = 0.01;

    if (r <= blend_start) {
      // sphère pure
      z = Math.sqrt(radius * radius - r * r);
    } else {//if (r < radius) {
      // r = Math.min(r, radius);
      // blend entre sphère et hyperboloïde
      const t = (r - blend_start) / (radius - blend_start); // ∈ [0,1] jusqu'au vrai bord
      const z_sphere = r < radius ? Math.sqrt(radius * radius - r * r) : 0;
      const r0 = blend_start / Math.SQRT2;
      const z_hyp = (r0 * r0) / Math.max(r, 1e-6);
      // sigmoïde sur t
      const s = t * t * (3 - 2 * t); // smoothstep, atteint exactement 1 en t=1
      z = z_sphere * (1 - s) + z_hyp * s;
    }
    //*/

    // console.log(sg.parameters.radius)
    // return new Vector3(x, y, z).normalize().multiplyScalar(99)

    // ORIGINAL METHOD /////////////////////////////////////////////////////////
    let threshold
    radius = 0.5
    threshold = radius / Math.SQRT2
    // threshold = 0.25

    const r0 = threshold
    const z0 = Math.sqrt(radius * radius - r0 * r0) // = r0 (car r0 = R/√2)
    const lambda = r0 / (z0 * z0) // pente raccordée
    z = z0 * Math.exp(-lambda * (r - r0))

    // let z; 
    // if (r < threshold) {
    //   z = Math.sqrt(radius * radius  - r * r);
    // } else {
    //   z = (threshold * threshold) / r;
    // }
    
    return new Vector3(x, y, z)//.normalize().multiplyScalar(1)

    // todo : adjust normFactor according to max z we want to crop to
    // (coords must be a point on the sphere otherwise it doesn't work
    // for some reason to be determined)
    // console.log(this.sphere.geometry.radius)
    // console.log(this.sphere.geometry)
    // return new Vector3(
    //   x * normFactor,
    //   y * normFactor,
    //   this.sphere.position.z// * this.sphere.geometry.radius
    // )
  }

  // SYNTHETIC EVENT LISTENERS /////////////////////////////////////////////////

  onStartDrag(newPosition: Vector3) {
    this.lastDragDate = Date.now()
    this.lastPointerPosition = newPosition
    this.rotationAngle = 0
    this.emit('start', newPosition)
  }

  onDrag(newPosition: Vector3) {
    if (newPosition.distanceTo(this.lastPointerPosition) > 0.001) {
      const now = Date.now()
      // const dt = (now - this.lastDragDate) * 0.001
      this.lastDragDate = now

      const lastPosNorm = this.lastPointerPosition.clone().normalize()
      const newPosNorm = newPosition.clone().normalize()

      this.rotationAxis = new Vector3().crossVectors(
        lastPosNorm,
        newPosNorm
      ).normalize()
  
      this.rotationAngle = lastPosNorm.angleTo(newPosNorm)
      
      const q = new Quaternion().setFromAxisAngle(
        this.rotationAxis,
        this.rotationAngle
      )

      q.multiply(this.sphere.quaternion)
      this.sphere.setRotationFromQuaternion(q)
      this.lastPointerPosition = newPosition
      this.emit('move', newPosition)
      this.emit('rotate', this.sphere.rotation)
    }
  }

  onEndDrag(/*updateDate :boolean*/) {
    const now = Date.now()
    /*
    if (updateDate) {
      //const now = Date.now()
      this.dt = (now - this.lastUpdateDate) * 0.001
      // this.lastUpdateDate = now
    } else {
      this.dt = (now - this.lastDragDate) * 0.001
    }
    */

    // we get the angular speed in rad.s-1
    const dt = (now - this.lastDragDate) * 0.001
    this.lastUpdateDate = now
    this.angularSpeed = this.rotationAngle / dt
    this.emit('end')
  }

  // REAL EVENT LISTENERS //////////////////////////////////////////////////////

  onPointerMove(e: PointerEvent) {
    const newPosition = this.getPointerPosition(e)

    if (newPosition !== null) {
      if (!this.pointerIsOver) {
        this.pointerIsOver = true
        if (this.pointerIsDown) {
          this.onStartDrag(newPosition)
        }
      } else {
        if (this.pointerIsDown) {
          this.onDrag(newPosition)
        }
      }
    } else {
      if (this.pointerIsOver) {
        this.pointerIsOver = false
        if (this.pointerIsDown) {
          // uncomment to allow inertia when hovering out
          // this.onEndDrag(true)
          this.onEndDrag
        }
      }
    }
  }

  onPointerDown(e: PointerEvent) {
    // use this to forbid more than 1 touch event
    // console.log(e.pointerId)
    this.pointerIsDown = true
    const newPosition = this.getPointerPosition(e)

    if (newPosition !== null) {
      this.pointerIsOver = true
      this.onStartDrag(newPosition)
    }
  }

  onPointerUp(/*e: PointerEvent*/) {
    this.pointerIsDown = false
    // const newPosition = this.getPointerPosition(e)

    if (this.pointerIsOver) {
      // this.onEndDrag(false)
      this.onEndDrag()
    }
  }

  // UPDATE LOGIC //////////////////////////////////////////////////////////////

  update() {
    const now = Date.now()

    if (this.pointerIsDown && this.pointerIsOver) {
      // we're dragging, do nothing here
    } else {
      const inertia = false
      if (inertia && this.angularSpeed > 0.001) {
        const dt = (now - this.lastUpdateDate) * 0.001
        this.angularSpeed -= (this.angularSpeed * this.friction)
        const deltaAngle = this.angularSpeed * dt
        const q = new Quaternion().setFromAxisAngle(
          this.rotationAxis,
          deltaAngle
        )
        q.multiply(this.sphere.quaternion)
        this.sphere.setRotationFromQuaternion(q)
        this.emit('rotate', this.sphere.rotation)
      } else {
        this.angularSpeed = 0
      }
    }

    this.lastUpdateDate = now
  }
};

export default SphereModelVersorControl