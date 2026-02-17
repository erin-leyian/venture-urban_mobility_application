def merge_sort(routes, key='trip_count', reverse=True):
    if len(routes) <= 1:
        return routes

    mid = len(routes) // 2
    left = merge_sort(routes[:mid], key, reverse)
    right = merge_sort(routes[mid:], key, reverse)

    return merge(left, right, key, reverse)


def merge(left, right, key, reverse):
    result = []
    i = j = 0

    while i < len(left) and j < len(right):
        if reverse:
            if left[i][key] >= right[j][key]:
                result.append(left[i])
                i += 1
            else:
                result.append(right[j])
                j += 1
        else:
            if left[i][key] <= right[j][key]:
                result.append(left[i])
                i += 1
            else:
                result.append(right[j])
                j += 1

    result.extend(left[i:])
    result.extend(right[j:])
    return result