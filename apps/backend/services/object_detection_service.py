from models import detection_models
from utils import image_utils

def process_frame(base64_string):
    # Decode image
    img = image_utils.decode_base64_image(base64_string)
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # YOLO detection
    results = detection_models.model(img_rgb)
    best_box = None
    max_conf = 0
    best_class_name = None
    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            if conf > max_conf:
                max_conf = conf
                best_box = box
                best_class_name = detection_models.model.names[int(box.cls[0])]

    # MiDaS depth estimation
    img_tensor = detection_models.midas_transforms(img_rgb).unsqueeze(0)
    with torch.no_grad():
        depth = detection_models.midas(img_tensor)
    depth_map = depth.squeeze().numpy()
    depth_map = cv2.resize(depth_map, (img.shape[1], img.shape[0]))
    depth_map = cv2.normalize(depth_map, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    # Process detection
    detection_result = {}
    if best_box is not None:
        x1, y1, x2, y2 = map(int, best_box.xyxy[0])
        center_x, center_y = (x1 + x2) // 2, (y1 + y2) // 2
        estimated_depth = depth_map[center_y, center_x] * detection_models.depth_scale_factor
        detection_result = {
            "class": best_class_name,
            "confidence": max_conf,
            "depth": estimated_depth,
            "box": [x1, y1, x2, y2]
        }
    return detection_result